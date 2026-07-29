import { memo, useCallback, useMemo, useState } from "react"
import {
  CalendarDays,
  DoorOpen,
  Plus,
  StickyNote,
  User,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react"
import { uz } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { addDays, busyRoomsIn, nightsBetween } from "./geometry"
import { groupThousands } from "./labels"
import { Field, Section, StayCard } from "./modal-parts"
import { DOC_TYPES, DocSelect, MoneyInput, Segmented } from "./form-parts"
import { RoomPicker } from "./room-picker"
import type {
  CalendarBlockKind,
  CalendarBooking,
  CalendarCreateInput,
  CalendarDraft,
  CalendarGuestInput,
  CalendarLabels,
  CalendarRoom,
} from "./types"


interface CalendarCreateDialogProps {
  draft: CalendarDraft | null
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  labels: CalendarLabels
  today: string
  onClose: () => void
  onSubmit: (input: CalendarCreateInput) => void | Promise<void>
}

type Mode = "booking" | "block"
type PayMode = "unpaid" | "partial" | "full"

interface CompanionDraft extends CalendarGuestInput {
  key: string
  charged: boolean
}

const MIN_PHONE_DIGITS = 7
const QUICK_NIGHTS = [1, 2, 3, 7]
const BLOCK_KINDS: CalendarBlockKind[] = ["maintenance", "cleaning", "hold", "other"]

let seq = 0

const EXTRA_RATE_KEY = "safora_extra_guest_rate"

function readExtraRate(): string {
  try {
    const raw = localStorage.getItem(EXTRA_RATE_KEY) ?? ""
    return /^\d+$/.test(raw) ? raw : ""
  } catch {
    return ""
  }
}

function saveExtraRate(v: string): void {
  try {
    localStorage.setItem(EXTRA_RATE_KEY, v)
  } catch {
  }
}

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00`)
const dateToIso = (d: Date) => d.toLocaleDateString("en-CA")

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

function fmtLongDate(iso: string, labels: CalendarLabels): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${d}-${labels.months[m - 1]} · ${labels.weekdaysShort[dow]}`
}

/**
 * Summani og'irliklar bo'yicha taqsimlaydi, natijalar yig'indisi AYNAN `amount`ga teng bo'ladi
 * (yaxlitlash qoldig'i birinchi qatorlarga qo'shiladi). Og'irliklar nol bo'lsa (masalan hamma
 * xona 0 so'mga qo'yilgan) teng bo'linadi — aks holda pul yo'qolib qolardi.
 */
function spread(amount: number, weights: number[]): number[] {
  const n = weights.length
  if (n === 0 || amount <= 0) return weights.map(() => 0)
  const sum = weights.reduce((a, b) => a + b, 0)
  const w = sum > 0 ? weights : weights.map(() => 1)
  const total = sum > 0 ? sum : n
  const parts = w.map((x) => Math.floor((amount * x) / total))
  let rest = amount - parts.reduce((a, b) => a + b, 0)
  for (let i = 0; rest > 0 && i < n; i++) {
    parts[i]++
    rest--
  }
  return parts
}

/**
 * Guruh avansini xonalar bo'yicha taqsimlaydi. `spread`dan farqi — har xona o'z summasidan
 * ORTIQ avans ololmaydi (server ham shuni rad etadi).
 */
function distributePaid(paid: number, totals: number[]): number[] {
  const sum = totals.reduce((a, b) => a + b, 0)
  if (paid <= 0 || sum <= 0) return totals.map(() => 0)
  if (paid >= sum) return totals.slice()

  const parts = totals.map((t) => Math.floor((paid * t) / sum))
  let rest = paid - parts.reduce((a, b) => a + b, 0)
  for (let i = 0; rest > 0 && i < parts.length; i++) {
    const room = totals[i] - parts[i]
    const add = Math.min(rest, room)
    parts[i] += add
    rest -= add
  }
  return parts
}

export function CalendarCreateDialog(props: CalendarCreateDialogProps) {
  const { draft, onClose } = props
  return (
    <Dialog open={draft != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent variant="fullscreen" showCloseButton={false} className="bg-white">
        {/* key = qoralama: boshqa katakdan ochilganda forma toza boshlanadi. */}
        {draft && <CreateForm key={`${draft.roomId}:${draft.start}:${draft.end}`} {...props} draft={draft} />}
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({
  draft,
  rooms,
  bookings,
  labels,
  today,
  onClose,
  onSubmit,
}: CalendarCreateDialogProps & { draft: CalendarDraft }) {
  const [mode, setMode] = useState<Mode>("booking")

  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestDocType, setGuestDocType] = useState("")
  const [guestDocNumber, setGuestDocNumber] = useState("")
  const [companions, setCompanions] = useState<CompanionDraft[]>([])
  const [extraRate, setExtraRate] = useState(readExtraRate)
  const [note, setNote] = useState("")

  const [blockKind, setBlockKind] = useState<CalendarBlockKind>("maintenance")
  const [blockReason, setBlockReason] = useState("")

  const [start, setStart] = useState(draft.start)
  const [end, setEnd] = useState(draft.end)
  const [selectedIds, setSelectedIds] = useState<string[]>([draft.roomId])
  /** Faqat QO'LDA o'zgartirilgan summalar. Tegilmagan xona `rate × kechalar`ga ergashadi. */
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [payMode, setPayMode] = useState<PayMode>("unpaid")
  const [partialInput, setPartialInput] = useState("")
  const [busy, setBusy] = useState(false)

  const isBlock = mode === "block"
  const tone = isBlock ? "slate" : "brand"
  const nights = nightsBetween(start, end)

  // Sana o'zgarganda qayta hisoblanadi — bitta o'tishda (`O(bronlar)`), xona bo'yicha emas.
  // Tanlangan xona band bo'lib qolsa qizarib ko'rinadi (jimgina tanlovdan tushib ketmaydi).
  const busyRoomIds = useMemo(() => busyRoomsIn(bookings, start, end), [bookings, start, end])
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])

  // Tanlov TARTIBI saqlanadi — xulosadagi qatorlar xodim bosgan ketma-ketlikda tursin.
  const lines = useMemo(
    () =>
      selectedIds.flatMap((id) => {
        const room = roomsById.get(id)
        if (!room) return []
        const suggested = room.rate != null ? Math.round(room.rate * Math.max(nights, 0)) : 0
        const raw = overrides[id]
        return [{ room, suggested, raw: raw ?? String(suggested), total: Number(raw ?? suggested) }]
      }),
    [selectedIds, roomsById, overrides, nights],
  )

  const amountsValid = lines.every((l) => l.raw !== "" && Number.isFinite(l.total) && l.total >= 0)
  const roomsTotal = amountsValid ? lines.reduce((sum, l) => sum + l.total, 0) : 0

  // ── Qo'shimcha o'rin puli ────────────────────────────────────────────────
  // Bir xonaga ikkinchi mehmon qo'shilsa mehmonxona odatda qo'shimcha oladi, lekin HAR DOIM
  // emas (bola, xodim, aksiya). Shuning uchun qaror har mehmon qatorida — switch bilan.
  const chargedGuests = companions.reduce((n, c) => n + (c.charged ? 1 : 0), 0)
  const extraRateNum = extraRate === "" ? 0 : Number(extraRate)
  const extraTotal =
    isBlock || !Number.isFinite(extraRateNum)
      ? 0
      : chargedGuests * extraRateNum * Math.max(nights, 0)

  const grandTotal = roomsTotal + extraTotal

  const partialPaid = partialInput === "" ? 0 : Number(partialInput)
  const paid = payMode === "full" ? grandTotal : payMode === "partial" ? partialPaid : 0
  const paidTooBig = payMode === "partial" && Number.isFinite(partialPaid) && partialPaid > grandTotal

  const guestTotal = 1 + companions.length
  /**
   * Sig'imdan oshgan holat — OGOHLANTIRISH, hech qachon to'siq emas: 2 kishilik xonaga
   * qo'shimcha joy qo'yib 3 kishi joylashtirish odatiy hol. Solishtirish TANLANGAN XONALARNING
   * YIG'MA sig'imi bilan: ilgari har xona alohida tekshirilardi va 3 mehmon 3 ta yakka xonaga
   * olinganda ham bekorga ogohlantirardi.
   */
  const capacity = useMemo(() => {
    if (isBlock || lines.length === 0) return null
    let sum = 0
    for (const l of lines) {
      if (l.room.capacity == null) return null // biror xonada sig'im belgilanmagan — jim turamiz
      sum += l.room.capacity
    }
    return sum
  }, [lines, isBlock])
  const overCapacity = capacity != null && guestTotal > capacity

  const selectedBusy = selectedIds.some((id) => busyRoomIds.has(id))
  // Blokni O'TMISHGA qo'yish ruxsat etilgan (ta'mir ko'pincha keyin ro'yxatga olinadi), bron esa yo'q.
  const inPast = !isBlock && start < today
  const phoneDigits = guestPhone.replace(/\D/g, "")
  const companionsValid = companions.every((c) => c.fullName.trim().length > 0)

  const valid =
    nights >= 1 &&
    !inPast &&
    lines.length > 0 &&
    !selectedBusy &&
    (isBlock ||
      (guestName.trim().length > 0 &&
        phoneDigits.length >= MIN_PHONE_DIGITS &&
        companionsValid &&
        amountsValid &&
        !paidTooBig))

  // ── Barqaror handler'lar ─────────────────────────────────────────────────
  // Og'ir bo'laklar (`RoomPicker`, hamrohlar, xulosa) `memo` ostida — bu funksiyalar har
  // render'da yangidan tug'ilsa memo'ning ma'nosi qolmasdi.
  const setRange = useCallback((s: string, e: string) => {
    setStart(s)
    setEnd(e)
  }, [])

  const patchCompanion = useCallback(
    (key: string, patch: Partial<CompanionDraft>) =>
      setCompanions((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c))),
    [],
  )

  const addCompanion = useCallback(
    () =>
      setCompanions((prev) => [
        ...prev,
        // Standart — TO'LOVLI: mehmonxonalarning ko'pi qo'shimcha o'rin uchun pul oladi;
        // istisno (bola, aksiya) bir bosishda o'chiriladi.
        { key: `c${prev.length}-${seq++}`, fullName: "", charged: true },
      ]),
    [],
  )

  const removeCompanion = useCallback(
    (key: string) => setCompanions((prev) => prev.filter((c) => c.key !== key)),
    [],
  )

  const changeExtraRate = useCallback((v: string) => {
    setExtraRate(v)
    saveExtraRate(v)
  }, [])

  const setOverride = useCallback(
    (roomId: string, v: string) => setOverrides((prev) => ({ ...prev, [roomId]: v })),
    [],
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      if (isBlock) {
        await onSubmit({
          mode: "block",
          start,
          end,
          roomIds: lines.map((l) => l.room.id),
          kind: blockKind,
          ...(blockReason.trim() ? { reason: blockReason.trim() } : {}),
        })
      } else {
        // Backendda "qo'shimcha o'rin" alohida maydon EMAS (bulk bron faqat `totalAmount`
        // oladi), shuning uchun u xonalar summasiga QO'SHIB yuboriladi — xonalar ulushiga
        // proporsional. Xodim buni xulosada alohida qator bo'lib ko'radi, mehmon esa baribir
        // yagona "Jami"ni to'laydi.
        const roomTotals = lines.map((l) => l.total)
        const extraShare = spread(extraTotal, roomTotals)
        const finalTotals = roomTotals.map((t, i) => t + extraShare[i])
        const perRoomPaid = distributePaid(paid, finalTotals)
        await onSubmit({
          mode: "booking",
          start,
          end,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          ...(guestDocType ? { guestDocType } : {}),
          ...(guestDocNumber.trim() ? { guestDocNumber: guestDocNumber.trim() } : {}),
          ...(companions.length
            ? {
                guests: companions.map(({ fullName, phone, docType, docNumber }) => ({
                  fullName: fullName.trim(),
                  ...(phone?.trim() ? { phone: phone.trim() } : {}),
                  ...(docType ? { docType } : {}),
                  ...(docNumber?.trim() ? { docNumber: docNumber.trim() } : {}),
                })),
              }
            : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          rooms: lines.map((l, i) => ({
            roomId: l.room.id,
            totalAmount: finalTotals[i],
            paidAmount: perRoomPaid[i],
          })),
        })
      }
      onClose()
    } catch {
      // Xato xabari container'da (toast) ko'rsatiladi; forma OCHIQ qoladi — xodim terganini
      // (mehmon, xonalar, avans) qaytadan kiritmasin, faqat band xonani almashtirsin.
    } finally {
      setBusy(false)
    }
  }

  // XATO — qilingan ish noto'g'ri (qizil). TALAB — hali qilinmagan ish (neytral). Ikkalasi
  // aralashtirilmaydi: bo'sh formani ochishning o'zi "xato" emas, lekin tugma nega o'chiqligi
  // baribir aytilishi kerak — ilgari hech narsa yozilmasdi va xodim tugmani bosaverardi.
  const footerError = inPast
    ? labels.pastStart
    : selectedBusy
      ? labels.selectedBusy
      : paidTooBig
        ? labels.prepaymentTooBig
        : null

  const footerNeed =
    footerError || valid
      ? null
      : lines.length === 0
        ? labels.needRoom
        : isBlock
          ? null
          : guestName.trim().length === 0
            ? labels.needGuestName
            : phoneDigits.length < MIN_PHONE_DIGITS
              ? labels.needGuestPhone
              : !companionsValid
                ? labels.needCompanionName
                : null

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      {/* ── Sarlavha + rejim almashtirgich ────────────────────────────────── */}
      <header className="hairline-b flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6">
        <div className="min-w-0">
          <DialogTitle className="text-lg leading-tight font-semibold text-neutral-900">
            {isBlock ? labels.blockTitle : labels.newBooking}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-sm text-neutral-500 tabular-nums">
            {fmtDay(start, labels)} – {fmtDay(end, labels)}
            {nights >= 1 && ` · ${labels.nights(nights)}`}
            {lines.length > 0 && ` · ${labels.roomsSelected(lines.length)}`}
            {!isBlock && guestTotal > 1 && ` · ${labels.guestsWord(guestTotal)}`}
          </DialogDescription>
        </div>

        {/* Aksent rejim bilan almashadi: bron = brend orange, yopish = sovuq slate. Bu shunchaki
            bezak emas — yaratilajak narsaning kalendardagi rangi bilan BIR XIL, shuning uchun
            xodim natijani oldindan ko'radi. */}
        <Segmented
          className="ml-auto"
          value={mode}
          onChange={(m) => setMode(m as Mode)}
          tone={tone}
          options={[
            { value: "booking", label: labels.modeBooking, icon: <User className="size-3.5" /> },
            { value: "block", label: labels.modeBlock, icon: <Wrench className="size-3.5" /> },
          ]}
        />

        <Button type="button" variant="ghost" size="icon" aria-label={labels.close} onClick={onClose}>
          <X />
        </Button>
      </header>

      {/* ── Tana: ish maydoni + turg'un xulosa ────────────────────────────── */}
      {/* Kichik ekranda BITTA scroll (ustunlar tik tizilади), lg dan boshlab ikkita mustaqil. */}
      <div className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="app-scroll min-h-0 flex-1 lg:overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-6 sm:px-6">
            {isBlock ? (
              <Section icon={<Wrench className="size-3.5" />} title={labels.blockKind}>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {BLOCK_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setBlockKind(k)}
                        aria-pressed={blockKind === k}
                        className={cn(
                          "rounded-control px-3 py-2 text-xs font-medium transition-colors",
                          blockKind === k
                            ? "bg-cal-block-surface text-cal-block-foreground ring-1 ring-cal-block-border"
                            : "bg-neutral-100 text-neutral-500 hover:text-neutral-800",
                        )}
                      >
                        {labels.blockKindText[k]}
                      </button>
                    ))}
                  </div>
                  <Field label={labels.blockReason}>
                    <Input
                      className="h-9"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder={labels.blockReasonHint}
                    />
                  </Field>
                </div>
              </Section>
            ) : (
              <>
                <Section icon={<User className="size-3.5" />} title={labels.guest}>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Field label={labels.guestName}>
                      <Input
                        className="h-9"
                        autoFocus
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                      />
                    </Field>
                    <Field label={labels.guestPhone}>
                      <Input
                        className="h-9"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        inputMode="tel"
                        placeholder="+998 ..."
                        required
                      />
                    </Field>
                    <Field label={labels.document}>
                      <DocSelect
                        labels={labels}
                        value={guestDocType}
                        onChange={setGuestDocType}
                        className="h-9 w-full"
                      />
                    </Field>
                    <Field label={labels.docNumber}>
                      <Input
                        className="h-9"
                        value={guestDocNumber}
                        onChange={(e) => setGuestDocNumber(e.target.value)}
                      />
                    </Field>
                  </div>
                </Section>

                <CompanionsBlock
                  labels={labels}
                  companions={companions}
                  nights={nights}
                  extraRate={extraRate}
                  extraTotal={extraTotal}
                  chargedGuests={chargedGuests}
                  guestTotal={guestTotal}
                  onPatch={patchCompanion}
                  onAdd={addCompanion}
                  onRemove={removeCompanion}
                  onExtraRate={changeExtraRate}
                />
              </>
            )}

            <StayBlock
              labels={labels}
              start={start}
              end={end}
              nights={nights}
              today={today}
              isBlock={isBlock}
              onChange={setRange}
            />

            <Section
              icon={<DoorOpen className="size-3.5" />}
              title={labels.rooms}
              aside={
                <span className={cn("text-xs", lines.length > 0 ? "text-neutral-500" : "text-neutral-400")}>
                  {labels.roomsSelected(lines.length)}
                </span>
              }
            >
              <RoomPicker
                rooms={rooms}
                labels={labels}
                nights={nights}
                tone={tone}
                showRate={!isBlock}
                selected={selectedIds}
                busy={busyRoomIds}
                onChange={setSelectedIds}
              />
              <p className="text-xs text-neutral-400">
                {lines.length > 1 && !isBlock ? labels.groupHint(lines.length) : labels.roomsPickHint}
              </p>
            </Section>

            {!isBlock && (
              <Section icon={<StickyNote className="size-3.5" />} title={labels.note}>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={labels.notePlaceholder}
                  rows={2}
                />
              </Section>
            )}
          </div>
        </div>

        {/* ── O'ng ustun: yashash + narx + to'lov xulosasi ─────────────────── */}
        {/* Ajratuvchi chiziq YO'Q — sirt kontrasti (bg-neutral-50) yetarli (design.md). */}
        <aside className="app-scroll flex min-h-0 shrink-0 flex-col gap-5 bg-neutral-50 px-5 py-6 lg:w-[23rem] lg:overflow-y-auto">
          <StayCard
            arrivalLabel={labels.arrival}
            departureLabel={labels.departure}
            arrival={fmtLongDate(start, labels)}
            departure={fmtLongDate(end, labels)}
            arrivalTime={labels.checkInTime}
            departureTime={labels.checkOutTime}
            className="bg-white ring-1 ring-neutral-200/70"
          />

          {isBlock ? (
            <div className="rounded-card bg-cal-block-surface p-3.5 text-xs leading-relaxed text-cal-block-foreground">
              {labels.blockHint}
            </div>
          ) : (
            <MoneyPanel
              labels={labels}
              lines={lines}
              nights={nights}
              extraTotal={extraTotal}
              chargedGuests={chargedGuests}
              grandTotal={grandTotal}
              paid={paid}
              payMode={payMode}
              partialInput={partialInput}
              paidTooBig={paidTooBig}
              overCapacity={overCapacity ? (capacity as number) : null}
              guestTotal={guestTotal}
              onOverride={setOverride}
              onPayMode={setPayMode}
              onPartial={setPartialInput}
            />
          )}
        </aside>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="hairline-t flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-5 py-3 sm:px-6">
        {footerError ? (
          <p className="mr-auto text-xs font-medium text-destructive">{footerError}</p>
        ) : (
          <>
            {!isBlock && lines.length > 0 && (
              // Jami footer'da HAM turadi: kichik ekranda o'ng ustun pastga tushib ketadi va
              // xodim mehmonga aytadigan raqam ko'rinmay qolardi.
              <p className="mr-auto flex items-baseline gap-2 text-sm">
                <span className="text-neutral-500">{labels.total}</span>
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {labels.money(grandTotal)}
                </span>
              </p>
            )}
            {footerNeed && (
              <p className={cn("text-xs text-neutral-500", !(!isBlock && lines.length > 0) && "mr-auto")}>
                {footerNeed}
              </p>
            )}
          </>
        )}
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={!valid || busy}
          className={cn(
            // Yaratilajak narsaning kalendardagi rangi — tugmada ham o'sha.
            isBlock &&
              "bg-cal-block-foreground text-on-fill hover:bg-cal-block-foreground/90 focus-visible:ring-cal-block-foreground",
          )}
        >
          {isBlock ? labels.createBlock : labels.create}
        </Button>
      </footer>
    </form>
  )
}

// ── Muddat ───────────────────────────────────────────────────────────────────

const StayBlock = memo(function StayBlock({
  labels,
  start,
  end,
  nights,
  today,
  isBlock,
  onChange,
}: {
  labels: CalendarLabels
  start: string
  end: string
  nights: number
  today: string
  isBlock: boolean
  onChange: (start: string, end: string) => void
}) {
  const [open, setOpen] = useState(false)

  const pickRange = (from: Date, to?: Date) => {
    const s = dateToIso(from)
    const e = to ? dateToIso(to) : ""
    // Bir marta bosilganda (yoki kirish = chiqish) 1 kecha — forma hech qachon 0 kechada turmaydi.
    onChange(s, e && e !== s ? e : addDays(s, 1))
    if (e && e !== s) setOpen(false)
  }

  return (
    <Section icon={<CalendarDays className="size-3.5" />} title={`${labels.arrival} – ${labels.departure}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9 justify-start gap-2 font-normal">
              <CalendarDays className="text-neutral-500" />
              <span className="tabular-nums">
                {fmtDay(start, labels)} – {fmtDay(end, labels)}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              locale={uz}
              defaultMonth={isoToDate(start)}
              // Blok o'tmishga ham qo'yiladi: ta'mir ko'pincha allaqachon boshlangan bo'ladi.
              disabled={isBlock ? undefined : { before: isoToDate(today) }}
              selected={{ from: isoToDate(start), to: isoToDate(end) }}
              onSelect={(range) => range?.from && pickRange(range.from, range.to)}
            />
          </PopoverContent>
        </Popover>

        {/* Tez kecha soni — sudrab tanlagandan keyin ham eng ko'p uchraydigan tuzatish. */}
        <div className="flex items-center gap-1" role="group" aria-label={labels.quickNights}>
          {QUICK_NIGHTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(start, addDays(start, n))}
              aria-pressed={nights === n}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-control text-sm font-medium tabular-nums transition-colors",
                nights === n
                  ? isBlock
                    ? "bg-cal-block-surface text-cal-block-foreground"
                    : "bg-brand-100 text-brand-800"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
              )}
            >
              {n}
            </button>
          ))}
          <span className="ml-0.5 text-xs text-neutral-400">{labels.nightsWord}</span>
        </div>
      </div>
    </Section>
  )
})

// ── Hamroh mehmonlar + qo'shimcha o'rin puli ─────────────────────────────────

interface CompanionsBlockProps {
  labels: CalendarLabels
  companions: CompanionDraft[]
  nights: number
  extraRate: string
  extraTotal: number
  chargedGuests: number
  guestTotal: number
  onPatch: (key: string, patch: Partial<CompanionDraft>) => void
  onAdd: () => void
  onRemove: (key: string) => void
  onExtraRate: (v: string) => void
}

const CompanionsBlock = memo(function CompanionsBlock({
  labels,
  companions,
  nights,
  extraRate,
  extraTotal,
  chargedGuests,
  guestTotal,
  onPatch,
  onAdd,
  onRemove,
  onExtraRate,
}: CompanionsBlockProps) {
  return (
    <Section
      icon={<Users className="size-3.5" />}
      title={labels.companions}
      aside={<span className="text-xs text-neutral-500 tabular-nums">{labels.guestsWord(guestTotal)}</span>}
    >
      <div className="flex flex-col gap-2">
        {companions.map((c, i) => (
          <div key={c.key} className="flex flex-wrap items-center gap-2 rounded-card bg-neutral-50 px-2.5 py-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[0.6875rem] font-medium text-neutral-500 tabular-nums">
              {i + 2}
            </span>

            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Input
                value={c.fullName}
                onChange={(e) => onPatch(c.key, { fullName: e.target.value })}
                placeholder={labels.guestName}
                aria-label={labels.guestName}
                required
              />
              <Input
                value={c.phone ?? ""}
                onChange={(e) => onPatch(c.key, { phone: e.target.value })}
                inputMode="tel"
                placeholder={labels.guestPhone}
                aria-label={labels.guestPhone}
              />
              <DocSelect
                labels={labels}
                value={c.docType ?? ""}
                onChange={(v) => onPatch(c.key, { docType: v })}
                className="w-full"
              />
              <Input
                value={c.docNumber ?? ""}
                onChange={(e) => onPatch(c.key, { docNumber: e.target.value })}
                placeholder={labels.docNumber}
                aria-label={labels.docNumber}
              />
            </div>

            {/* Qo'shimcha o'rin puli olinadimi — qaror AYNAN shu mehmon qatorida turadi:
                bola/xodim uchun istisno qilish bitta bosish. */}
            <label className="flex shrink-0 cursor-pointer items-center gap-2 pl-1 text-xs font-medium text-neutral-500 select-none">
              {labels.extraGuestCharge}
              <Switch
                size="sm"
                checked={c.charged}
                onCheckedChange={(v) => onPatch(c.key, { charged: v })}
              />
            </label>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={labels.removeGuest}
              onClick={() => onRemove(c.key)}
            >
              <X />
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button type="button" variant="outline" className="h-9" onClick={onAdd}>
            <Plus /> {labels.addGuest}
          </Button>

          {companions.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                {labels.extraGuestRate}
                <MoneyInput
                  value={extraRate}
                  onChange={onExtraRate}
                  ariaLabel={labels.extraGuestRate}
                  className="h-9 w-28"
                />
              </label>
              {chargedGuests > 0 && (
                <span className="text-xs text-neutral-400 tabular-nums">
                  {extraTotal > 0
                    ? `${labels.extraGuestsBreakdown(chargedGuests, Math.max(nights, 0))} = ${labels.money(extraTotal)}`
                    : labels.extraGuestRateHint}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Section>
  )
})

// ── Xulosa: summa + to'lov ───────────────────────────────────────────────────

interface MoneyLine {
  room: CalendarRoom
  raw: string
  total: number
}

interface MoneyPanelProps {
  labels: CalendarLabels
  lines: MoneyLine[]
  nights: number
  extraTotal: number
  chargedGuests: number
  grandTotal: number
  paid: number
  payMode: PayMode
  partialInput: string
  paidTooBig: boolean
  /** Sig'im oshgan bo'lsa — tanlangan xonalarning YIG'MA sig'imi, aks holda `null`. */
  overCapacity: number | null
  guestTotal: number
  onOverride: (roomId: string, v: string) => void
  onPayMode: (m: PayMode) => void
  onPartial: (v: string) => void
}

const MoneyPanel = memo(function MoneyPanel({
  labels,
  lines,
  nights,
  extraTotal,
  chargedGuests,
  grandTotal,
  paid,
  payMode,
  partialInput,
  paidTooBig,
  overCapacity,
  guestTotal,
  onOverride,
  onPayMode,
  onPartial,
}: MoneyPanelProps) {
  return (
    <>
      {overCapacity != null && (
        // Ogohlantirish, TO'SIQ EMAS — forma to'liq yuboriladi.
        <div className="rounded-card bg-warning-surface p-3 text-xs leading-relaxed text-warning-surface-foreground">
          {labels.capacityOver(guestTotal, overCapacity)}
        </div>
      )}

      <Section icon={<Wallet className="size-3.5" />} title={labels.amount}>
        {lines.length === 0 ? (
          <p className="text-xs text-neutral-400">{labels.roomsSelected(0)}</p>
        ) : (
          <div className="divide-hairline flex flex-col rounded-card bg-white ring-1 ring-neutral-200/70">
            {lines.map((l) => (
              <div key={l.room.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-800">{l.room.label}</p>
                  {l.room.rate != null && nights >= 1 && (
                    <p className="text-[0.6875rem] text-neutral-400 tabular-nums">
                      {groupThousands(l.room.rate)} × {nights}
                    </p>
                  )}
                </div>
                <MoneyInput
                  value={l.raw}
                  onChange={(v) => onOverride(l.room.id, v)}
                  ariaLabel={`${l.room.label} — ${labels.amount}`}
                  className="w-24"
                />
              </div>
            ))}

            {extraTotal > 0 && (
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-800">{labels.extraGuests}</p>
                  <p className="text-[0.6875rem] text-neutral-400 tabular-nums">
                    {labels.extraGuestsBreakdown(chargedGuests, Math.max(nights, 0))}
                  </p>
                </div>
                <span className="text-sm font-medium text-neutral-900 tabular-nums">
                  {groupThousands(extraTotal)}
                </span>
              </div>
            )}

            <div className="flex items-baseline justify-between px-3 py-2.5">
              <span className="text-xs font-medium text-neutral-500">{labels.total}</span>
              <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                {labels.money(grandTotal)}
              </span>
            </div>
          </div>
        )}
      </Section>

      <Section title={labels.payment}>
        <div className="flex flex-col gap-2.5">
          <Segmented
            value={payMode}
            onChange={(v) => onPayMode(v as PayMode)}
            tone="brand"
            size="sm"
            options={[
              { value: "unpaid", label: labels.paymentUnpaid },
              { value: "partial", label: labels.paymentPartial },
              { value: "full", label: labels.paymentFull },
            ]}
          />

          {payMode === "partial" && (
            <MoneyInput
              value={partialInput}
              onChange={onPartial}
              ariaLabel={labels.prepayment}
              className={cn("h-9 w-full", paidTooBig && "ring-1 ring-destructive")}
            />
          )}

          {lines.length > 0 && (
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-neutral-500">{labels.remaining}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  grandTotal - paid > 0 ? "text-warning" : "text-success-surface-foreground",
                )}
              >
                {labels.money(Math.max(0, grandTotal - paid))}
              </span>
            </div>
          )}
        </div>
      </Section>
    </>
  )
})

export { DOC_TYPES }
