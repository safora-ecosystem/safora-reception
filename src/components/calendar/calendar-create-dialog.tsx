import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  Building03Icon,
  Calendar03Icon,
  Cancel01Icon,
  Door01Icon,
  PlusSignIcon,
  Note01Icon,
  User02Icon,
  UserMultiple02Icon,
  Wallet02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { uz } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PhoneInput, isPhoneComplete } from "@/components/ui/phone-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { addDays, busyRoomsIn, nightsBetween } from "./geometry"
import { groupThousands } from "./labels"
import { Field, Section, StayCard } from "./modal-parts"
import { DOC_TYPES, DocSelect, Segmented } from "./form-parts"
import { MoneyInput } from "@/components/shared/money-input"
import {
  OrganizationPicker,
  OrganizationTerms,
  RoomingList,
  distributeNames,
  newRoomingGuest,
  type RoomingGuest,
  type RoomingMap,
} from "./corporate-parts"
import { RoomPicker } from "./room-picker"
import type {
  CalendarBlockKind,
  CalendarBooking,
  CalendarCreateInput,
  CalendarDraft,
  CalendarGuestInput,
  CalendarLabels,
  CalendarOrganization,
  CalendarRoom,
} from "./types"


interface CalendarCreateDialogProps {
  draft: CalendarDraft | null
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  organizations?: CalendarOrganization[]
  labels: CalendarLabels
  today: string
  onClose: () => void
  onSubmit: (input: CalendarCreateInput) => void | Promise<void>
}

type Mode = "booking" | "corporate" | "block"
type PayMode = "unpaid" | "partial" | "full"

interface CompanionDraft extends CalendarGuestInput {
  key: string
  rate: string
}

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
  return labels.formatDay(iso)
}

function fmtLongDate(iso: string, labels: CalendarLabels): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${labels.formatDay(iso)} · ${labels.weekdaysShort[dow]}`
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
  organizations,
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

  // Korporativ: kim to'laydi + xona bo'yicha joylashtirish ro'yxati.
  const [orgId, setOrgId] = useState("")
  const [orgRef, setOrgRef] = useState("")
  const [rooming, setRooming] = useState<RoomingMap>({})

  const [start, setStart] = useState(draft.start)
  const [end, setEnd] = useState(draft.end)
  const [selectedIds, setSelectedIds] = useState<string[]>([draft.roomId])
  const [payMode, setPayMode] = useState<PayMode>("unpaid")
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "transfer">("cash")
  const [partialInput, setPartialInput] = useState("")
  const [busy, setBusy] = useState(false)
  // Avans qatorlarining idempotentlik kalitlari — dialogning BITTA ochilishi davomida har
  // xonaga bitta kalit. Submit ichida yaratilsa 409'dan keyingi qayta urinish YANGI kalit
  // olardi va server dubl avans yozardi; muvaffaqiyatda dialog yopiladi, keyingisi toza.
  const eventIdsRef = useRef<Record<string, string>>({})
  const eventIdFor = (roomId: string) =>
    (eventIdsRef.current[roomId] ??= crypto.randomUUID())

  const isBlock = mode === "block"
  const isCorporate = mode === "corporate"
  const tone = isBlock ? "slate" : "brand"
  const nights = nightsBetween(start, end)

  const orgs = organizations ?? []
  const org = orgs.find((o) => o.id === orgId) ?? null
  // Shartnoma chegirmasi — narxning YAGONA korporativ o'zgaruvchisi. Resepshn summani qo'lda
  // yozmaydi (biznes chegarasi), shuning uchun korporativ tarif ham faqat shu foizdan chiqadi.
  const discountPct = isCorporate ? Math.min(100, Math.max(0, org?.discountPercent ?? 0)) : 0

  // Sana o'zgarganda qayta hisoblanadi — bitta o'tishda (`O(bronlar)`), xona bo'yicha emas.
  // Tanlangan xona band bo'lib qolsa qizarib ko'rinadi (jimgina tanlovdan tushib ketmaydi).
  const busyRoomIds = useMemo(() => busyRoomsIn(bookings, start, end), [bookings, start, end])
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])

  // Tanlov TARTIBI saqlanadi — xulosadagi qatorlar xodim bosgan ketma-ketlikda tursin.
  // Summa FAQAT xona tarifidan: `rate × kechalar`. Qo'lda yozish ATAYLAB yo'q — bu biznes
  // chegarasi: xodim narxni kamaytirib yozib, farqni naqd olishi mumkin edi. Narx Xonalar
  // bo'limida (owner/manager) belgilanadi, resepshn esa faqat natijani ko'radi.
  const lines = useMemo(
    () =>
      selectedIds.flatMap((id) => {
        const room = roomsById.get(id)
        if (!room) return []
        // Rack (shartnomasiz) summa — chegirma undan hisoblanadi va xulosada ALOHIDA qator
        // bo'lib ko'rinadi: kompaniya nima uchun kamroq to'layotgani ekranda yozilib tursin.
        const rack = room.rate != null ? Math.round(room.rate * Math.max(nights, 0)) : 0
        const total = discountPct > 0 ? Math.round((rack * (100 - discountPct)) / 100) : rack
        return [{ room, rack, total, hasRate: room.rate != null }]
      }),
    [selectedIds, roomsById, nights, discountPct],
  )

  // Tarifi kiritilmagan xonaga bron OCHILMAYDI: 0 so'mlik bron xuddi o'sha teshikning
  // boshqa eshigi bo'lardi (xodim ataylab shunday xonaga joylashtirib naqd oladi).
  const missingRate = !isBlock && lines.some((l) => !l.hasRate)
  const roomsTotal = lines.reduce((sum, l) => sum + l.total, 0)
  const rackTotal = lines.reduce((sum, l) => sum + l.rack, 0)
  const discountTotal = rackTotal - roomsTotal

  // ── Qo'shimcha o'rin puli ────────────────────────────────────────────────
  // Bir xonaga ikkinchi mehmon qo'shilsa mehmonxona odatda qo'shimcha oladi, lekin narx HAR
  // MEHMONDA O'ZINIKI (katta to'liq, bola chegirmali, xodim 0 = bepul) — shuning uchun qaror
  // ham, summa ham har mehmon qatorida.
  //
  // KORPORATIVDA bu qator YO'Q: u yerda narx shartnomadan keladi (xona tarifi × chegirma) va
  // qo'shimcha o'rinni resepshn qo'lda narxlab qo'ysa, shartnoma sharti ekranda buzilardi.
  const chargedGuests = companions.reduce((n, c) => n + (Number(c.rate || 0) > 0 ? 1 : 0), 0)
  const extraTotal =
    isBlock || isCorporate
      ? 0
      : companions.reduce((sum, c) => sum + Number(c.rate || 0), 0) * Math.max(nights, 0)

  const grandTotal = roomsTotal + extraTotal

  // ── Joylashtirish ro'yxati (korporativ) ──────────────────────────────────
  // Tanlangan xonalar o'zgarganda ro'yxat ergashadi: yangi xona bitta bo'sh qator bilan
  // ochiladi, tanlovdan chiqqan xona esa ro'yxatdan tushadi. Effekt xonalar RO'YXATIga
  // bog'langan — ism terish uni qayta ishga tushirmaydi.
  useEffect(() => {
    if (!isCorporate) return
    setRooming((prev) => {
      let changed = false
      const next: RoomingMap = {}
      for (const id of selectedIds) {
        if (prev[id]) next[id] = prev[id]
        else {
          next[id] = [newRoomingGuest()]
          changed = true
        }
      }
      if (!changed && Object.keys(prev).length === selectedIds.length) return prev
      return next
    })
  }, [isCorporate, selectedIds])

  const roomingRooms = useMemo(() => lines.map((l) => l.room), [lines])
  const roomingGuestTotal = roomingRooms.reduce((n, r) => n + (rooming[r.id]?.length ?? 0), 0)
  const roomingNamed = roomingRooms.every((r) =>
    (rooming[r.id] ?? []).some((g) => g.fullName.trim().length > 0),
  )

  const partialPaid = partialInput === "" ? 0 : Number(partialInput)
  // Korporativ bronda resepshn PUL OLMAYDI — server ham avansni rad etadi.
  const paid = isCorporate
    ? 0
    : payMode === "full"
      ? grandTotal
      : payMode === "partial"
        ? partialPaid
        : 0
  const paidTooBig =
    !isCorporate && payMode === "partial" && Number.isFinite(partialPaid) && partialPaid > grandTotal

  const guestTotal = isCorporate ? roomingGuestTotal : 1 + companions.length
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
  // E.164 + libphonenumber katalogi: uzunlik ham, operator prefiksi ham davlatiga qarab tekshiriladi.
  const phoneValid = isPhoneComplete(guestPhone)
  const companionsValid = companions.every((c) => c.fullName.trim().length > 0)

  const valid =
    nights >= 1 &&
    !inPast &&
    lines.length > 0 &&
    !selectedBusy &&
    (isBlock ||
      (isCorporate
        ? // Korporativda "asosiy mehmon" yagona emas — har xona o'z odamiga ega bo'lishi kerak.
          orgId !== "" && roomingNamed && !missingRate
        : guestName.trim().length > 0 &&
          phoneValid &&
          companionsValid &&
          !missingRate &&
          !paidTooBig))

  // ── Barqaror handler'lar ─────────────────────────────────────────────────
  // Og'ir bo'laklar (`RoomPicker`, hamrohlar, xulosa) `memo` ostida — bu funksiyalar har
  // render'da yangidan tug'ilsa memo'ning ma'nosi qolmasdi.
  const setRange = useCallback((s: string, e: string) => {
    setStart(s)
    setEnd(e)
  }, [])

  const patchCompanion = useCallback((key: string, patch: Partial<CompanionDraft>) => {
    // Terilgan narx keyingi bronlar uchun odatiy qiymat bo'lib qoladi (qurilma keshiga).
    if (patch.rate != null) saveExtraRate(patch.rate)
    setCompanions((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  }, [])

  const addCompanion = useCallback(
    () =>
      setCompanions((prev) => [
        ...prev,
        // Narx oldindan to'ldirilgan holda keladi (oxirgi ishlatilgan qiymat): mehmonxonalarning
        // ko'pi qo'shimcha o'rin uchun pul oladi; istisno (bola, xodim) — narxni o'chirish kifoya.
        { key: `c${prev.length}-${seq++}`, fullName: "", rate: readExtraRate() },
      ]),
    [],
  )

  const removeCompanion = useCallback(
    (key: string) => setCompanions((prev) => prev.filter((c) => c.key !== key)),
    [],
  )

  const setRoomGuests = useCallback(
    (roomId: string, guests: RoomingGuest[]) => setRooming((prev) => ({ ...prev, [roomId]: guests })),
    [],
  )

  /** Kompaniya yuborgan ismlar ro'yxatini xonalarga tarqatadi (sig'im bo'yicha). */
  const distribute = useCallback(
    (names: string[]) =>
      setRooming(distributeNames(names, roomingRooms.map((r) => ({ id: r.id, capacity: r.capacity })))),
    [roomingRooms],
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
      } else if (isCorporate) {
        // Har xona O'Z mehmonlari bilan ketadi: ro'yxatning birinchi odami asosiy mehmon
        // (bron ustunlari — QR va chat kaliti), qolganlari hamroh. Avans YO'Q — pul kompaniyadan.
        await onSubmit({
          mode: "booking",
          start,
          end,
          organizationId: orgId,
          ...(orgRef.trim() ? { orgRef: orgRef.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          rooms: lines.map((l) => {
            const people = (rooming[l.room.id] ?? []).filter((g) => g.fullName.trim().length > 0)
            const [primary, ...rest] = people
            return {
              roomId: l.room.id,
              totalAmount: l.total,
              paidAmount: 0,
              guestName: primary.fullName.trim(),
              ...(primary.phone?.trim() ? { guestPhone: primary.phone.trim() } : {}),
              ...(primary.docType ? { guestDocType: primary.docType } : {}),
              ...(primary.docNumber?.trim() ? { guestDocNumber: primary.docNumber.trim() } : {}),
              ...(rest.length
                ? {
                    guests: rest.map(({ fullName, phone, docType, docNumber }) => ({
                      fullName: fullName.trim(),
                      ...(phone?.trim() ? { phone: phone.trim() } : {}),
                      ...(docType ? { docType } : {}),
                      ...(docNumber?.trim() ? { docNumber: docNumber.trim() } : {}),
                    })),
                  }
                : {}),
            }
          }),
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
          // Usul faqat pul olinayotganda ma'noli; kalit ham faqat avansli xonaga.
          ...(paid > 0 ? { method: payMethod } : {}),
          rooms: lines.map((l, i) => ({
            roomId: l.room.id,
            totalAmount: finalTotals[i],
            paidAmount: perRoomPaid[i],
            ...(perRoomPaid[i] > 0 ? { eventId: eventIdFor(l.room.id) } : {}),
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
      : missingRate
        ? labels.rateNotSetError
        : paidTooBig
          ? labels.prepaymentTooBig
          : null

  const footerNeed =
    footerError || valid
      ? null
      : isCorporate
        ? orgId === ""
          ? labels.needOrganization
          : lines.length === 0
            ? labels.needRoom
            : !roomingNamed
              ? labels.needRoomingName
              : null
        : lines.length === 0
          ? labels.needRoom
          : isBlock
            ? null
            : guestName.trim().length === 0
              ? labels.needGuestName
              : !phoneValid
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
            {isBlock ? labels.blockTitle : isCorporate ? labels.corporateTitle : labels.newBooking}
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
        {/* Korporativ variant FAQAT shartnomali mijoz bo'lsa chiqadi: tashkilot qo'shmagan
            mehmonxonaga ishlamaydigan tugma ko'rsatilmaydi (ruxsati yo'q xodimda ham ro'yxat
            bo'sh keladi, ya'ni bitta shart ikkala holatni yopadi). */}
        <Segmented
          className="ml-auto"
          value={mode}
          onChange={(m) => setMode(m as Mode)}
          tone={tone}
          options={[
            { value: "booking", label: labels.modeBooking, icon: <Icon icon={User02Icon} className="size-3.5" /> },
            ...(orgs.length > 0
              ? [
                  {
                    value: "corporate",
                    label: labels.modeCorporate,
                    icon: <Icon icon={Building03Icon} className="size-3.5" />,
                  },
                ]
              : []),
            { value: "block", label: labels.modeBlock, icon: <Icon icon={Wrench01Icon} className="size-3.5" /> },
          ]}
        />

        <Button type="button" variant="ghost" size="icon" aria-label={labels.close} onClick={onClose}>
          <Icon icon={Cancel01Icon} />
        </Button>
      </header>

      {/* ── Tana: ish maydoni + turg'un xulosa ────────────────────────────── */}
      {/* Kichik ekranda BITTA scroll (ustunlar tik tizilади), lg dan boshlab ikkita mustaqil. */}
      <div className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="app-scroll min-h-0 flex-1 lg:overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-6 sm:px-6">
            {isBlock ? (
              <Section icon={<Icon icon={Wrench01Icon} className="size-3.5" />} title={labels.blockKind}>
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
            ) : isCorporate ? (
              // Korporativda birinchi savol MEHMON emas, TO'LOVCHI: shartnoma chegirmasi narxni,
              // qarz shifti esa ogohlantirishni belgilaydi, ya'ni qolgan hamma narsa shunga bog'liq.
              <Section icon={<Icon icon={Building03Icon} className="size-3.5" />} title={labels.organization}>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <Field label={labels.organization}>
                    <OrganizationPicker
                      labels={labels}
                      organizations={orgs}
                      value={orgId}
                      onChange={setOrgId}
                    />
                  </Field>
                  <Field label={labels.orgRef}>
                    <Input
                      className="h-9"
                      value={orgRef}
                      onChange={(e) => setOrgRef(e.target.value)}
                      placeholder={labels.orgRefHint}
                      maxLength={64}
                    />
                  </Field>
                </div>
                {org && (
                  <OrganizationTerms
                    labels={labels}
                    org={org}
                    projectedBalance={(org.balance ?? 0) + grandTotal}
                  />
                )}
              </Section>
            ) : (
              <>
                <Section icon={<Icon icon={User02Icon} className="size-3.5" />} title={labels.guest}>
                  {/* Telefon ustuni kengroq — davlat tanlagich ham, raqam ham sig'sin. */}
                  <div className="grid gap-3 sm:grid-cols-2 xl:[grid-template-columns:1.1fr_1.4fr_1fr_1fr]">
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
                      <PhoneInput
                        value={guestPhone}
                        onChange={setGuestPhone}
                        aria-label={labels.guestPhone}
                        required
                      />
                    </Field>
                    <Field label={labels.document}>
                      <DocSelect
                        labels={labels}
                        value={guestDocType}
                        onChange={(v) => {
                          setGuestDocType(v)
                          // Tur bo'shatilsa seriya ham ketadi — "raqam bor, turi yo'q" bo'lmasin.
                          if (!v) setGuestDocNumber("")
                        }}
                      />
                    </Field>
                    <Field label={labels.docNumber}>
                      <Input
                        value={guestDocNumber}
                        onChange={(e) => setGuestDocNumber(e.target.value)}
                        placeholder={labels.docNumber}
                        disabled={!guestDocType}
                      />
                    </Field>
                  </div>
                </Section>

                <CompanionsBlock
                  labels={labels}
                  companions={companions}
                  nights={nights}
                  extraTotal={extraTotal}
                  chargedGuests={chargedGuests}
                  guestTotal={guestTotal}
                  onPatch={patchCompanion}
                  onAdd={addCompanion}
                  onRemove={removeCompanion}
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
              icon={<Icon icon={Door01Icon} className="size-3.5" />}
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

            {/* Joylashtirish ro'yxati XONALARDAN KEYIN turadi — u tanlangan xonalar ustiga
                quriladi va bo'sh xona ro'yxatida ko'rsatadigan narsa yo'q. */}
            {isCorporate && lines.length > 0 && (
              <Section
                icon={<Icon icon={UserMultiple02Icon} className="size-3.5" />}
                title={labels.rooming}
                aside={
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {labels.guestsWord(roomingGuestTotal)}
                  </span>
                }
              >
                <RoomingList
                  labels={labels}
                  rooms={roomingRooms}
                  value={rooming}
                  onChange={setRoomGuests}
                  onDistribute={distribute}
                />
              </Section>
            )}

            {!isBlock && (
              <Section icon={<Icon icon={Note01Icon} className="size-3.5" />} title={labels.note}>
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
              discountTotal={discountTotal}
              grandTotal={grandTotal}
              paid={paid}
              payMode={payMode}
              payMethod={payMethod}
              partialInput={partialInput}
              paidTooBig={paidTooBig}
              overCapacity={overCapacity ? (capacity as number) : null}
              guestTotal={guestTotal}
              corporate={isCorporate}
              onPayMode={setPayMode}
              onPayMethod={setPayMethod}
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
    <Section icon={<Icon icon={Calendar03Icon} className="size-3.5" />} title={`${labels.arrival} – ${labels.departure}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9 justify-start gap-2 font-normal">
              <Icon icon={Calendar03Icon} className="text-neutral-500" />
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
  extraTotal: number
  chargedGuests: number
  guestTotal: number
  onPatch: (key: string, patch: Partial<CompanionDraft>) => void
  onAdd: () => void
  onRemove: (key: string) => void
}

const CompanionsBlock = memo(function CompanionsBlock({
  labels,
  companions,
  nights,
  extraTotal,
  chargedGuests,
  guestTotal,
  onPatch,
  onAdd,
  onRemove,
}: CompanionsBlockProps) {
  const reduce = useReducedMotion()
  return (
    <Section
      icon={<Icon icon={UserMultiple02Icon} className="size-3.5" />}
      title={labels.companions}
      aside={<span className="text-xs text-neutral-500 tabular-nums">{labels.guestsWord(guestTotal)}</span>}
    >
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {companions.map((c, i) => (
            // Qator paydo bo'lishi/yo'qolishi balandlik bilan ochilib-yopiladi — height animatsiyasi
            // qo'shni qatorlarni tabiiy oqim bilan o'zi suradi, shuning uchun `layout` prop ATAYLAB
            // yo'q: u har render'da o'lchov (reflow) qo'shib, qator ichida terishni sekinlashtirardi.
            <motion.div
              key={c.key}
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              {/* items-start: kichik ekranda maydonlar ikki qatorga o'ralganda № va X birinchi
                  qator bilan tekis qoladi (markazda "suzib" yurmaydi). Narx GRID ICHIDA —
                  o'ralganda ham boshqa maydonlar bilan bitta to'rda turadi, alohida sakramaydi. */}
              <div className="flex flex-wrap items-start gap-2 rounded-card bg-neutral-50 px-2.5 py-2">
                <span className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-[0.6875rem] font-medium text-neutral-500 tabular-nums">
                  {i + 2}
                </span>

                {/* Telefon ustuni kengroq (davlat tanlagich + raqam), narx qat'iy 7rem. */}
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:[grid-template-columns:1.1fr_1.4fr_1fr_1fr_7rem]">
                  <Input
                    value={c.fullName}
                    onChange={(e) => onPatch(c.key, { fullName: e.target.value })}
                    placeholder={labels.guestName}
                    aria-label={labels.guestName}
                    required
                  />
                  <PhoneInput
                    value={c.phone ?? ""}
                    onChange={(v) => onPatch(c.key, { phone: v })}
                    aria-label={labels.guestPhone}
                  />
                  <DocSelect
                    labels={labels}
                    value={c.docType ?? ""}
                    onChange={(v) => onPatch(c.key, { docType: v, ...(v ? {} : { docNumber: "" }) })}
                  />
                  <Input
                    value={c.docNumber ?? ""}
                    onChange={(e) => onPatch(c.key, { docNumber: e.target.value })}
                    placeholder={labels.docNumber}
                    aria-label={labels.docNumber}
                    disabled={!c.docType}
                  />
                  {/* Shu mehmonning bir kechalik narxi — qaror AYNAN shu qatorda: bola chegirmali,
                      xodim bepul (bo'sh/0). Yagona umumiy narx bu istisnolarni sig'dirmasdi. */}
                  <MoneyInput
                    value={c.rate ?? ""}
                    onChange={(v) => onPatch(c.key, { rate: v })}
                    ariaLabel={labels.extraGuestRate}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.removeGuest}
                  onClick={() => onRemove(c.key)}
                  className="mt-1"
                >
                  <Icon icon={Cancel01Icon} />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button type="button" variant="outline" className="h-9" onClick={onAdd}>
            <Icon icon={PlusSignIcon} /> {labels.addGuest}
          </Button>

          {chargedGuests > 0 && extraTotal > 0 && (
            <span className="text-xs text-neutral-400 tabular-nums">
              {labels.extraGuestsBreakdown(chargedGuests, Math.max(nights, 0))} ={" "}
              {labels.money(extraTotal)}
            </span>
          )}
        </div>
      </div>
    </Section>
  )
})

// ── Xulosa: summa + to'lov ───────────────────────────────────────────────────

interface MoneyLine {
  room: CalendarRoom
  /** Chegirmasiz (rack) summa — korporativda chegirma shu ikkisining farqi bo'lib ko'rinadi. */
  rack: number
  total: number
  hasRate: boolean
}

interface MoneyPanelProps {
  labels: CalendarLabels
  lines: MoneyLine[]
  nights: number
  extraTotal: number
  chargedGuests: number
  /** Shartnoma chegirmasi (so'm). 0 bo'lsa qator umuman chiqmaydi. */
  discountTotal: number
  grandTotal: number
  paid: number
  payMode: PayMode
  partialInput: string
  paidTooBig: boolean
  /** Sig'im oshgan bo'lsa — tanlangan xonalarning YIG'MA sig'imi, aks holda `null`. */
  overCapacity: number | null
  guestTotal: number
  /** Korporativ: to'lov tanlagichi o'rniga "kompaniya hisobiga" izohi chiqadi. */
  corporate: boolean
  /** Avans usuli — pul olinayotgandagina ko'rinadi (payMode ≠ unpaid). */
  payMethod: "cash" | "card" | "transfer"
  onPayMode: (m: PayMode) => void
  onPayMethod: (m: "cash" | "card" | "transfer") => void
  onPartial: (v: string) => void
}

const MoneyPanel = memo(function MoneyPanel({
  labels,
  lines,
  nights,
  extraTotal,
  chargedGuests,
  discountTotal,
  grandTotal,
  paid,
  payMode,
  partialInput,
  paidTooBig,
  overCapacity,
  guestTotal,
  corporate,
  payMethod,
  onPayMode,
  onPayMethod,
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

      <Section icon={<Icon icon={Wallet02Icon} className="size-3.5" />} title={labels.amount}>
        {lines.length === 0 ? (
          <p className="text-xs text-neutral-400">{labels.roomsSelected(0)}</p>
        ) : (
          <div className="divide-hairline flex flex-col rounded-card bg-white ring-1 ring-neutral-200/70">
            {/* Summalar FAQAT O'QILADI — narx xona tarifidan keladi, resepshn uni yozmaydi
                (biznes chegarasi, sabab `lines` hisoblanadigan joyda). */}
            {lines.map((l) => (
              <div key={l.room.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-800">{l.room.label}</p>
                  {l.hasRate && nights >= 1 && (
                    <p className="text-[0.6875rem] text-neutral-400 tabular-nums">
                      {groupThousands(l.room.rate as number)} × {nights}
                    </p>
                  )}
                </div>
                {l.hasRate ? (
                  <span className="text-sm font-medium text-neutral-900 tabular-nums">
                    {groupThousands(l.rack)}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-warning-surface-foreground">
                    {labels.rateNotSet}
                  </span>
                )}
              </div>
            ))}

            {/* Chegirma ALOHIDA qator: kompaniya nima uchun kamroq to'layotgani ekranda
                yozilib tursin — "narx o'zi shunaqa" degan noaniqlik qolmasin. */}
            {discountTotal > 0 && (
              <div className="flex items-center gap-2 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-xs font-medium text-brand-700">
                  {labels.corporateDiscountLine}
                </p>
                <span className="text-sm font-medium text-brand-700 tabular-nums">
                  −{groupThousands(discountTotal)}
                </span>
              </div>
            )}

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
          {/* Korporativda to'lov tanlagichi UMUMAN yo'q — bu shunchaki "sukut bo'yicha to'lanmagan"
              emas, biznes qoidasi: pul kompaniyadan olinadi va server ham avansni rad etadi.
              Tanlagichni o'chirib qo'yish (disabled) o'rniga olib tashlash — "bosib bo'lmaydigan
              tugma" savol tug'dirardi, matn esa javob beradi. */}
          {corporate ? (
            <div className="rounded-card bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">
              <p className="font-medium">{labels.corporateBilling}</p>
              <p className="mt-0.5 text-brand-700">{labels.corporateBillingHint}</p>
            </div>
          ) : (
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
          )}

          {/* Usul — pul olinayotgandagina so'raladi. Naqd oldindan tanlangan (eng ko'p holat),
              lekin karta bir bosishda: usulni to'g'ri yozish kassa (smena) hisobining o'zagi. */}
          {!corporate && payMode !== "unpaid" && (
            <Segmented
              value={payMethod}
              onChange={(v) => onPayMethod(v as "cash" | "card" | "transfer")}
              size="sm"
              options={[
                { value: "cash", label: labels.paymentMethodText.cash ?? "cash" },
                { value: "card", label: labels.paymentMethodText.card ?? "card" },
                { value: "transfer", label: labels.paymentMethodText.transfer ?? "transfer" },
              ]}
            />
          )}

          {/* Yorliq maydon USTIDA: `lg` o'lchamda uzun matnli placeholder raqamning o'rnini
              egallab, maydonni "matn maydoni"dek ko'rsatib qo'yardi. */}
          {!corporate && payMode === "partial" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-600">{labels.prepayment}</span>
              <MoneyInput
                value={partialInput}
                onChange={onPartial}
                ariaLabel={labels.prepayment}
                size="lg"
                invalid={paidTooBig}
                className="w-full"
              />
            </label>
          )}

          {!corporate && lines.length > 0 && (
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
