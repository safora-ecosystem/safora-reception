import { useMemo, useState } from "react"
import {
  CalendarDays,
  Check,
  DoorOpen,
  Plus,
  Search,
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { addDays, hasConflict, nightsBetween } from "./geometry"
import { groupThousands } from "./labels"
import { Field, Section, StayCard } from "./modal-parts"
import { DOC_TYPES, DocFields, MoneyInput, Segmented } from "./form-parts"
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

interface CompanionDraft extends CalendarGuestInput {
  key: string
}

const MIN_PHONE_DIGITS = 7
const SEARCH_THRESHOLD = 8
const QUICK_NIGHTS = [1, 2, 3, 7]
const BLOCK_KINDS: CalendarBlockKind[] = ["maintenance", "cleaning", "hold", "other"]

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
 * Guruh avansini xonalar bo'yicha taqsimlaydi: har xonaga o'z ulushiga PROPORSIONAL, yaxlitlash
 * qoldig'i esa birinchi xonalarga qo'shiladi. Shart — natijalar yig'indisi kiritilgan summaga
 * AYNAN teng bo'lsin (aks holda mehmon to'lagan pul kassada yo'qolib qolardi).
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
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
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
  const [note, setNote] = useState("")

  const [blockKind, setBlockKind] = useState<CalendarBlockKind>("maintenance")
  const [blockReason, setBlockReason] = useState("")

  const [start, setStart] = useState(draft.start)
  const [end, setEnd] = useState(draft.end)
  const [selectedIds, setSelectedIds] = useState<string[]>([draft.roomId])
  /** Faqat QO'LDA o'zgartirilgan summalar. Tegilmagan xona `rate × kechalar`ga ergashadi. */
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [payMode, setPayMode] = useState<"unpaid" | "partial" | "full">("unpaid")
  const [partialInput, setPartialInput] = useState("")
  const [roomQuery, setRoomQuery] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const isBlock = mode === "block"
  const nights = nightsBetween(start, end)

  // Qavat bo'yicha guruhlangan, filtrlangan ro'yxat. Reyd bilan bir xil tartib (order → label).
  const groups = useMemo(() => {
    const q = roomQuery.trim().toLowerCase()
    const sorted = [...rooms].sort(
      (a, b) =>
        (a.group ?? "").localeCompare(b.group ?? "") ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.label.localeCompare(b.label),
    )
    const out: { key: string; rooms: CalendarRoom[] }[] = []
    for (const r of sorted) {
      if (q && !r.label.toLowerCase().includes(q) && !(r.sublabel ?? "").toLowerCase().includes(q)) continue
      const key = r.group ?? ""
      const last = out.at(-1)
      if (last?.key === key) last.rooms.push(r)
      else out.push({ key, rooms: [r] })
    }
    return out
  }, [rooms, roomQuery])
  const visibleCount = groups.reduce((n, g) => n + g.rooms.length, 0)

  // Sana o'zgarganda qayta hisoblanadi — tanlangan xona band bo'lib qolsa qizarib ko'rinadi
  // (jimgina tanlovdan tushib ketmaydi: xodim nima o'zgarganini KO'RSIN).
  const busyRoomIds = useMemo(() => {
    if (nights < 1) return new Set<string>()
    const s = new Set<string>()
    for (const r of rooms) if (hasConflict({ roomId: r.id, start, end }, bookings)) s.add(r.id)
    return s
  }, [rooms, bookings, start, end, nights])

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
  const grandTotal = amountsValid ? lines.reduce((sum, l) => sum + l.total, 0) : 0

  const partialPaid = partialInput === "" ? 0 : Number(partialInput)
  const paid = payMode === "full" ? grandTotal : payMode === "partial" ? partialPaid : 0
  const paidTooBig = payMode === "partial" && Number.isFinite(partialPaid) && partialPaid > grandTotal

  const guestTotal = 1 + companions.length
  /** Sig'imdan oshgan xonalar — OGOHLANTIRISH, hech qachon to'siq emas: 2 kishilik xonaga
      qo'shimcha joy qo'yib 3 kishi joylashtirish odatiy hol. */
  const overCapacity = useMemo(
    () =>
      isBlock
        ? []
        : lines.filter((l) => l.room.capacity != null && guestTotal > l.room.capacity).map((l) => l.room),
    [lines, guestTotal, isBlock],
  )

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

  const toggleRoom = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const pickRange = (from: Date, to?: Date) => {
    const s = dateToIso(from)
    const e = to ? dateToIso(to) : ""
    setStart(s)
    // Bir marta bosilganda (yoki kirish = chiqish) 1 kecha — forma hech qachon 0 kechada turmaydi.
    setEnd(e && e !== s ? e : addDays(s, 1))
    if (e && e !== s) setPickerOpen(false)
  }

  const patchCompanion = (key: string, patch: Partial<CalendarGuestInput>) =>
    setCompanions((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)))

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
        const perRoomPaid = distributePaid(paid, lines.map((l) => l.total))
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
            totalAmount: l.total,
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

  const footerError = inPast
    ? labels.pastStart
    : selectedBusy
      ? labels.selectedBusy
      : paidTooBig
        ? labels.prepaymentTooBig
        : null

  return (
    <form onSubmit={submit} className="flex max-h-[92vh] flex-col">
      {/* ── Sarlavha + rejim almashtirgich ────────────────────────────────── */}
      <header className="hairline-b flex flex-wrap items-center justify-between gap-4 px-6 py-4 pr-14">
        <div className="min-w-0">
          <DialogTitle className="text-lg leading-tight font-semibold text-neutral-900">
            {isBlock ? labels.blockTitle : labels.newBooking}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-sm text-neutral-500 tabular-nums">
            {fmtDay(start, labels)} – {fmtDay(end, labels)}
            {nights >= 1 && ` · ${labels.nights(nights)}`}
            {lines.length > 0 && ` · ${labels.roomsSelected(lines.length)}`}
          </DialogDescription>
        </div>

        {/* Aksent rejim bilan almashadi: bron = brend orange, yopish = sovuq slate. Bu shunchaki
            bezak emas — yaratilajak narsaning kalendardagi rangi bilan BIR XIL, shuning uchun
            xodim natijani oldindan ko'radi. */}
        <Segmented
          value={mode}
          onChange={(m) => setMode(m as Mode)}
          tone={isBlock ? "slate" : "brand"}
          options={[
            { value: "booking", label: labels.modeBooking, icon: <User className="size-3.5" /> },
            { value: "block", label: labels.modeBlock, icon: <Wrench className="size-3.5" /> },
          ]}
        />
      </header>

      {/* ── Tana: chap (kiritish) + o'ng (xulosa) ─────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_20rem] md:overflow-hidden">
        <div className="app-scroll flex flex-col gap-6 p-6 md:overflow-y-auto">
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
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={labels.guestName}>
                      <Input autoFocus value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
                    </Field>
                    <Field label={labels.guestPhone}>
                      <Input
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        inputMode="tel"
                        placeholder="+998 ..."
                        required
                      />
                    </Field>
                  </div>
                  <DocFields
                    labels={labels}
                    docType={guestDocType}
                    docNumber={guestDocNumber}
                    onDocType={setGuestDocType}
                    onDocNumber={setGuestDocNumber}
                  />
                </div>
              </Section>

              <Section
                icon={<Users className="size-3.5" />}
                title={labels.companions}
                aside={
                  <span className="text-xs text-neutral-500 tabular-nums">{labels.guestsWord(guestTotal)}</span>
                }
              >
                <div className="flex flex-col gap-2.5">
                  {companions.map((c) => (
                    <div key={c.key} className="rounded-card bg-neutral-50 p-3">
                      <div className="flex items-start gap-2">
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                          <Input
                            value={c.fullName}
                            onChange={(e) => patchCompanion(c.key, { fullName: e.target.value })}
                            placeholder={labels.guestName}
                            required
                          />
                          <Input
                            value={c.phone ?? ""}
                            onChange={(e) => patchCompanion(c.key, { phone: e.target.value })}
                            inputMode="tel"
                            placeholder={labels.guestPhone}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={labels.removeGuest}
                          onClick={() => setCompanions((prev) => prev.filter((x) => x.key !== c.key))}
                        >
                          <X />
                        </Button>
                      </div>
                      <div className="mt-2 pr-9">
                        <DocFields
                          labels={labels}
                          docType={c.docType ?? ""}
                          docNumber={c.docNumber ?? ""}
                          onDocType={(v) => patchCompanion(c.key, { docType: v })}
                          onDocNumber={(v) => patchCompanion(c.key, { docNumber: v })}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 self-start rounded-control"
                    onClick={() =>
                      setCompanions((prev) => [...prev, { key: `c${prev.length}-${Date.now()}`, fullName: "" }])
                    }
                  >
                    <Plus /> {labels.addGuest}
                  </Button>
                </div>
              </Section>
            </>
          )}

          <Section icon={<CalendarDays className="size-3.5" />} title={`${labels.arrival} – ${labels.departure}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
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
                    onClick={() => setEnd(addDays(start, n))}
                    aria-pressed={nights === n}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-colors",
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

          <Section
            icon={<DoorOpen className="size-3.5" />}
            title={labels.rooms}
            aside={
              <span className={cn("text-xs", lines.length > 0 ? "text-neutral-500" : "text-neutral-400")}>
                {labels.roomsSelected(lines.length)}
              </span>
            }
          >
            <div className="flex flex-col gap-2">
              {rooms.length > SEARCH_THRESHOLD && (
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={roomQuery}
                    onChange={(e) => setRoomQuery(e.target.value)}
                    placeholder={labels.roomSearch}
                    className="pl-9"
                  />
                </div>
              )}

              <div className="app-scroll max-h-56 overflow-y-auto rounded-card p-1 ring-1 ring-neutral-200/70">
                {visibleCount === 0 ? (
                  <p className="p-4 text-center text-xs text-neutral-500">{labels.roomsEmpty}</p>
                ) : (
                  groups.map((g) => (
                    <div key={g.key || "—"}>
                      {g.key && (
                        <p className="sticky top-0 z-10 bg-white/90 px-2 py-1.5 text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase backdrop-blur-sm">
                          {g.key}
                        </p>
                      )}
                      {g.rooms.map((r) => (
                        <RoomRow
                          key={r.id}
                          room={r}
                          labels={labels}
                          nights={nights}
                          tone={isBlock ? "slate" : "brand"}
                          showRate={!isBlock}
                          selected={selectedIds.includes(r.id)}
                          busy={busyRoomIds.has(r.id)}
                          onToggle={() => toggleRoom(r.id)}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>

              {lines.length > 1 && !isBlock && (
                <p className="text-xs text-neutral-400">{labels.groupHint(lines.length)}</p>
              )}
            </div>
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

        {/* ── O'ng ustun: yashash + narx + to'lov xulosasi ─────────────────── */}
        {/* Ajratuvchi chiziq YO'Q — sirt kontrasti (bg-neutral-50) yetarli (design.md). */}
        <aside className="app-scroll flex flex-col gap-5 bg-neutral-50 p-6 md:overflow-y-auto">
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
            <>
              {overCapacity.length > 0 && (
                // Ogohlantirish, TO'SIQ EMAS — forma to'liq yuboriladi.
                <div className="rounded-card bg-warning-surface p-3 text-xs leading-relaxed text-warning-surface-foreground">
                  {labels.capacityOver(guestTotal, overCapacity[0].capacity as number)}
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
                          onChange={(v) => setOverrides((prev) => ({ ...prev, [l.room.id]: v }))}
                          ariaLabel={`${l.room.label} — ${labels.amount}`}
                          className="w-24"
                        />
                      </div>
                    ))}
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
                    onChange={(v) => setPayMode(v as typeof payMode)}
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
                      onChange={setPartialInput}
                      ariaLabel={labels.prepayment}
                      className={cn("w-full", paidTooBig && "ring-destructive")}
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
          )}
        </aside>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="hairline-t flex items-center justify-end gap-2 px-6 py-4">
        {footerError && <p className="mr-auto text-xs font-medium text-destructive">{footerError}</p>}
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={!valid || busy}
          className={cn(
            "rounded-control",
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

/** Xona qatori — tanlov holati RANG + BELGI bilan (faqat rangga tayanmaydi). */
function RoomRow({
  room,
  labels,
  nights,
  tone,
  showRate,
  selected,
  busy,
  onToggle,
}: {
  room: CalendarRoom
  labels: CalendarLabels
  nights: number
  tone: "brand" | "slate"
  showRate: boolean
  selected: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors",
        selected && !busy && (tone === "slate" ? "bg-cal-block-surface/60" : "bg-brand-50"),
        // Band xona TANLANGAN bo'lishi mumkin (sana keyin o'zgargan) — o'shanda qizarib turadi,
        // jimgina tushib qolmaydi. Bosib olib tashlash uchun ochiq qoladi.
        busy && (selected ? "bg-destructive-surface" : "opacity-45"),
        !selected && !busy && "hover:bg-neutral-50",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] transition-colors",
          selected
            ? tone === "slate"
              ? "bg-cal-block-foreground text-on-fill"
              : "bg-brand-500 text-on-fill"
            : "ring-1 ring-neutral-300",
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
        {room.label}
        {room.sublabel && <span className="font-normal text-neutral-500"> · {room.sublabel}</span>}
        {room.capacity != null && (
          <span className="font-normal text-neutral-400 tabular-nums"> · {room.capacity} o'rin</span>
        )}
      </span>

      {busy ? (
        <span className="shrink-0 text-[0.6875rem] font-medium text-destructive">{labels.busy}</span>
      ) : (
        showRate &&
        room.rate != null && (
          <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
            {groupThousands(room.rate)}
            {nights >= 1 && <span className="text-neutral-400"> × {nights}</span>}
          </span>
        )
      )}
    </button>
  )
}

export { DOC_TYPES }
