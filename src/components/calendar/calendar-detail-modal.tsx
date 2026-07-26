import { useMemo, useState } from "react"
import {
  BadgeCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  DoorOpen,
  LogIn,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Star,
  StickyNote,
  Trash2,
  User,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react"
import { uz } from "date-fns/locale"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { DocFields } from "./form-parts"
import { addDays, hasConflict, nightsBetween } from "./geometry"
import { Field, ReadValue, Section, StayCard } from "./modal-parts"
import type {
  BookingEditPatch,
  CalendarActivityEntry,
  CalendarBooking,
  CalendarGuest,
  CalendarGuestInput,
  CalendarLabels,
  CalendarPayment,
  CalendarPaymentEntry,
  CalendarRoom,
  CalendarStatus,
} from "./types"


interface CalendarDetailModalProps {
  booking: CalendarBooking | null
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  labels: CalendarLabels
  today: string
  guests?: CalendarGuest[] | null
  guestsLoading?: boolean
  onClose: () => void
  onCheckIn?: (id: string) => void | Promise<void>
  onCheckOut?: (id: string) => void | Promise<void>
  onCancel?: (id: string) => void | Promise<void>
  onEdit?: (id: string, patch: BookingEditPatch) => void | Promise<void>
  onAddGuest?: (bookingId: string, guest: CalendarGuestInput) => void | Promise<void>
  onUpdateGuest?: (
    bookingId: string,
    guestId: string,
    patch: Partial<CalendarGuestInput>,
  ) => void | Promise<void>
  onRemoveGuest?: (bookingId: string, guestId: string) => void | Promise<void>
  onSetPrimaryGuest?: (bookingId: string, guestId: string) => void | Promise<void>
  onRemoveBlock?: (id: string) => void | Promise<void>
  onDuplicate?: (booking: CalendarBooking) => void
  onOpenChat?: (booking: CalendarBooking) => void
}

const STATUS_CHIP: Record<CalendarStatus, string> = {
  booked: "bg-brand-100 text-brand-800",
  checked_in: "bg-success-surface text-success-surface-foreground",
  checked_out: "bg-neutral-100 text-neutral-500",
  cancelled: "bg-destructive-surface text-destructive-surface-foreground",
  blocked: "bg-cal-block-surface text-cal-block-foreground",
}

const MIN_PHONE_DIGITS = 7

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00`)
const dateToIso = (d: Date) => d.toLocaleDateString("en-CA")

function fmtLongDate(iso: string, labels: CalendarLabels): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${d}-${labels.months[m - 1]} · ${labels.weekdaysShort[dow]}`
}

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

/** Timestamp → "20-iyul · 14:22". LOKAL vaqt: bu real moment, xodim devor soatiga qaraydi. */
function fmtMoment(iso: string | null | undefined, labels: CalendarLabels): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${d.getDate()}-${labels.months[d.getMonth()]} · ${hh}:${mm}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

function paymentRatio(p: CalendarPayment): number {
  if (p.total > 0) return Math.max(0, Math.min(1, p.paid / p.total))
  return p.paid > 0 ? 1 : 0
}

/** Tarix nuqtasi — sodir bo'lgani to'q, bo'lmagani xira (kelajak qadam ham ko'rinib tursin). */
function TimelineRow({ done, label, at }: { done: boolean; label: string; at: string | null }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", done ? "bg-brand-500" : "bg-neutral-300")} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-medium", done ? "text-neutral-800" : "text-neutral-400")}>{label}</p>
        <p className="text-[0.6875rem] text-neutral-400 tabular-nums">{at ?? "—"}</p>
      </div>
    </li>
  )
}

export function CalendarDetailModal(props: CalendarDetailModalProps) {
  const { booking, onClose } = props
  const isBlock = booking?.status === "blocked"
  return (
    <Dialog open={booking != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn("max-h-[92vh] gap-0 overflow-hidden p-0", isBlock ? "sm:max-w-md" : "sm:max-w-3xl")}
      >
        {/* key = bron id: boshqa bronga o'tilganda tahrir holati toza boshlanadi. */}
        {booking &&
          (isBlock ? (
            <BlockBody key={booking.id} {...props} booking={booking} />
          ) : (
            <DetailBody key={booking.id} {...props} booking={booking} />
          ))}
      </DialogContent>
    </Dialog>
  )
}

/** Xona bloki — mehmon, pul va tarix yo'q, shuning uchun oyna ham ixcham. */
function BlockBody({
  booking: b,
  rooms,
  labels,
  onClose,
  onRemoveBlock,
}: CalendarDetailModalProps & { booking: CalendarBooking }) {
  const [busy, setBusy] = useState(false)
  const room = rooms.find((r) => r.id === b.roomId)
  const nights = nightsBetween(b.start, b.end)

  return (
    <div className="flex flex-col">
      <header className="hairline-b flex items-start gap-3.5 px-6 py-5 pr-14">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cal-block-surface text-cal-block-foreground">
          <Wrench className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="truncate text-lg leading-tight font-semibold text-neutral-900">
              {b.blockKind ? labels.blockKindText[b.blockKind] : labels.statusText.blocked}
            </DialogTitle>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_CHIP.blocked)}>
              {labels.statusText.blocked}
            </span>
          </div>
          <DialogDescription className="mt-1 truncate text-sm text-neutral-500 tabular-nums">
            {room ? `${labels.room} ${room.label}` : ""}
            {nights >= 1 ? ` · ${labels.nights(nights)}` : ""}
          </DialogDescription>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-6">
        <StayCard
          arrivalLabel={labels.arrival}
          departureLabel={labels.departure}
          arrival={fmtLongDate(b.start, labels)}
          departure={fmtLongDate(b.end, labels)}
          arrivalTime={labels.checkInTime}
          departureTime={labels.checkOutTime}
        />

        {b.sublabel && (
          <Field label={labels.blockReason}>
            <ReadValue>{b.sublabel}</ReadValue>
          </Field>
        )}

        <p className="rounded-card bg-cal-block-surface p-3.5 text-xs leading-relaxed text-cal-block-foreground">
          {labels.blockHint}
        </p>
      </div>

      <footer className="hairline-t flex items-center justify-end gap-2 px-6 py-4">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
        {onRemoveBlock && (
          <Button
            size="lg"
            className="rounded-control"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onRemoveBlock(b.id)
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            <DoorOpen /> {labels.unblock}
          </Button>
        )}
      </footer>
    </div>
  )
}

function DetailBody({
  booking: b,
  rooms,
  bookings,
  labels,
  today,
  guests,
  guestsLoading,
  onClose,
  onCheckIn,
  onCheckOut,
  onCancel,
  onEdit,
  onAddGuest,
  onUpdateGuest,
  onRemoveGuest,
  onSetPrimaryGuest,
  onDuplicate,
  onOpenChat,
}: CalendarDetailModalProps & { booking: CalendarBooking }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const [guestName, setGuestName] = useState(b.label)
  const [guestPhone, setGuestPhone] = useState(b.sublabel ?? "")
  const [roomId, setRoomId] = useState(b.roomId)
  const [start, setStart] = useState(b.start)
  const [end, setEnd] = useState(b.end)
  const [amount, setAmount] = useState(String(b.payment?.total ?? 0))
  const [paid, setPaid] = useState(String(b.payment?.paid ?? 0))
  const [note, setNote] = useState(b.note ?? "")

  // Server qoidasi bilan bir xil: kelmagan mehmonni ko'chirish mumkin, ichkaridagini esa faqat
  // uzaytirish (xona va kirish sanasi qulf), chiqib ketganini umuman emas.
  const canRelocate = b.status === "booked"
  const canExtend = b.status === "checked_in"
  const isClosed = b.status === "checked_out" || b.status === "cancelled"

  const roomsById = useMemo(() => {
    const m = new Map<string, CalendarRoom>()
    for (const r of rooms) m.set(r.id, r)
    return m
  }, [rooms])

  const viewRoom = roomsById.get(b.roomId)
  const editRoom = roomsById.get(roomId)
  const shownRoom = editing ? editRoom : viewRoom

  const nights = nightsBetween(editing ? start : b.start, editing ? end : b.end)
  const conflict = editing && (canRelocate || canExtend) && hasConflict({ roomId, start, end }, bookings, b.id)

  const amountNum = Number(amount.replace(/\s/g, ""))
  const paidNum = Number(paid.replace(/\s/g, ""))
  // Avans jami summadan oshmaydi — server ham aynan shu shartni majburlaydi (400).
  const amountValid =
    Number.isFinite(amountNum) && amountNum >= 0 && Number.isFinite(paidNum) && paidNum >= 0 && paidNum <= amountNum
  const phoneDigits = guestPhone.replace(/\D/g, "")
  const dirty =
    guestName.trim() !== b.label ||
    guestPhone.trim() !== (b.sublabel ?? "") ||
    roomId !== b.roomId ||
    start !== b.start ||
    end !== b.end ||
    amountNum !== (b.payment?.total ?? 0) ||
    paidNum !== (b.payment?.paid ?? 0) ||
    note.trim() !== (b.note ?? "")
  const valid =
    guestName.trim().length > 0 && phoneDigits.length >= MIN_PHONE_DIGITS && nights >= 1 && amountValid && !conflict

  /** Xona narxi × kechalar — resepshn summani qo'lda hisoblamasin. Uzaytirishda ayniqsa muhim:
      qo'shimcha kecha pulini xodim boshida hisoblab o'tirmaydi. */
  const suggested = editRoom?.rate != null ? Math.round(editRoom.rate * nights) : null

  const payment = b.payment
  const ratio = payment ? paymentRatio(payment) : 0
  const remaining = payment ? Math.max(0, payment.total - payment.paid) : 0

  const guestCount = guests?.length ?? b.guestCount ?? 1
  const overCapacity = viewRoom?.capacity != null && guestCount > viewRoom.capacity

  const run = async (fn?: (id: string) => void | Promise<void>) => {
    if (!fn || busy) return
    setBusy(true)
    try {
      await fn(b.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!onEdit || !valid || !dirty || busy) return
    const patch: BookingEditPatch = {}
    if (guestName.trim() !== b.label) patch.guestName = guestName.trim()
    if (guestPhone.trim() !== (b.sublabel ?? "")) patch.guestPhone = guestPhone.trim()
    if (canRelocate) {
      if (roomId !== b.roomId) patch.roomId = roomId
      if (start !== b.start) patch.start = start
    }
    // Chiqish sanasi ikkala holatda ham o'zgaradi — uzaytirish `checked_in` uchun ham ochiq.
    if ((canRelocate || canExtend) && end !== b.end) patch.end = end
    if (amountNum !== (b.payment?.total ?? 0)) patch.totalAmount = amountNum
    if (paidNum !== (b.payment?.paid ?? 0)) patch.paidAmount = paidNum
    if (note.trim() !== (b.note ?? "")) patch.note = note.trim()

    setBusy(true)
    try {
      await onEdit(b.id, patch)
      // Modal ochiq qoladi: `b` jonli massivdan keladi, refetch tugashi bilan yangi qiymatlar
      // shu yerda ko'rinadi — xodim o'z o'zgarishini tasdiqlangan holda ko'radi.
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const discard = () => {
    setGuestName(b.label)
    setGuestPhone(b.sublabel ?? "")
    setRoomId(b.roomId)
    setStart(b.start)
    setEnd(b.end)
    setAmount(String(b.payment?.total ?? 0))
    setPaid(String(b.payment?.paid ?? 0))
    setNote(b.note ?? "")
    setEditing(false)
  }

  return (
    <div className="flex max-h-[92vh] flex-col">
      {/* ── Sarlavha ─────────────────────────────────────────────────────── */}
      <header className="hairline-b flex items-start gap-3.5 px-6 py-5 pr-14">
        <Avatar className="size-11 shrink-0">
          <AvatarFallback className="bg-brand-100 text-sm font-semibold text-brand-800">
            {initials(b.label)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="truncate text-lg leading-tight font-semibold text-neutral-900">
              {b.label}
            </DialogTitle>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_CHIP[b.status])}>
              {labels.statusText[b.status]}
            </span>
            {b.guestConfirmed != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                  b.guestConfirmed
                    ? "bg-success-surface text-success-surface-foreground"
                    : "bg-neutral-100 text-neutral-500",
                )}
                title={labels.guestQr}
              >
                {/* Tasdiqlanmaganda "check" ikonkasi CHALG'ITADI — kutish holati soat bilan. */}
                {b.guestConfirmed ? <BadgeCheck className="size-3" /> : <Clock className="size-3" />}
                {b.guestConfirmed ? labels.confirmed : labels.notConfirmed}
              </span>
            )}
          </div>
          <DialogDescription className="mt-1 truncate text-sm text-neutral-500 tabular-nums">
            {b.sublabel || labels.guest}
            {shownRoom ? ` · ${labels.room} ${shownRoom.label}` : ""}
            {nights >= 1 ? ` · ${labels.nights(nights)}` : ""}
            {guestCount > 1 ? ` · ${labels.guestsWord(guestCount)}` : ""}
          </DialogDescription>
        </div>

        {!editing && onEdit && !isClosed && (
          <Button variant="outline" size="sm" className="shrink-0 rounded-control" onClick={() => setEditing(true)}>
            <Pencil /> {labels.edit}
          </Button>
        )}
      </header>

      {/* ── Tana: chap (tafsilot) + o'ng (tarix/harakat) ──────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_17rem] md:overflow-hidden">
        <div className="app-scroll flex flex-col gap-6 p-6 md:overflow-y-auto">
          <Section icon={<User className="size-3.5" />} title={labels.guest}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={labels.guestName}>
                {editing ? (
                  <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
                ) : (
                  <ReadValue>{b.label}</ReadValue>
                )}
              </Field>
              <Field label={labels.guestPhone}>
                {editing ? (
                  <Input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="+998 ..."
                    required
                  />
                ) : (
                  <ReadValue muted={!b.sublabel}>{b.sublabel || "—"}</ReadValue>
                )}
              </Field>
            </div>
          </Section>

          {/* ── Kim yashaydi ────────────────────────────────────────────── */}
          <Section
            icon={<Users className="size-3.5" />}
            title={labels.companions}
            aside={
              <span className={cn("text-xs tabular-nums", overCapacity ? "text-warning" : "text-neutral-500")}>
                {labels.guestsWord(guestCount)}
                {viewRoom?.capacity != null ? ` / ${viewRoom.capacity}` : ""}
              </span>
            }
          >
            <div className="flex flex-col gap-2">
              {overCapacity && viewRoom?.capacity != null && (
                // Ogohlantirish, TO'SIQ EMAS — qo'shimcha joy bilan joylashtirish odatiy hol.
                <p className="rounded-card bg-warning-surface p-2.5 text-xs leading-relaxed text-warning-surface-foreground">
                  {labels.capacityOver(guestCount, viewRoom.capacity)}
                </p>
              )}

              {guestsLoading && !guests ? (
                <p className="text-xs text-neutral-400">…</p>
              ) : (
                (guests ?? []).map((g) => (
                  <GuestRow
                    key={g.id}
                    guest={g}
                    labels={labels}
                    disabled={isClosed}
                    onSave={
                      onUpdateGuest ? (patch) => onUpdateGuest(b.id, g.id, patch) : undefined
                    }
                    onRemove={onRemoveGuest ? () => onRemoveGuest(b.id, g.id) : undefined}
                    onMakePrimary={onSetPrimaryGuest ? () => onSetPrimaryGuest(b.id, g.id) : undefined}
                  />
                ))
              )}

              {adding && onAddGuest ? (
                <NewGuestRow
                  labels={labels}
                  onCancel={() => setAdding(false)}
                  onSave={async (guest) => {
                    await onAddGuest(b.id, guest)
                    setAdding(false)
                  }}
                />
              ) : (
                onAddGuest &&
                !isClosed && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 self-start rounded-control"
                    onClick={() => setAdding(true)}
                  >
                    <Plus /> {labels.addGuest}
                  </Button>
                )
              )}
            </div>
          </Section>

          <Section icon={<DoorOpen className="size-3.5" />} title={labels.stay}>
            <div className="flex flex-col gap-3">
              <Field label={labels.room}>
                {editing && canRelocate ? (
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                          {r.sublabel ? ` · ${r.sublabel}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <ReadValue>
                    {viewRoom?.label ?? "—"}
                    {viewRoom?.sublabel ? (
                      <span className="font-normal text-neutral-500"> · {viewRoom.sublabel}</span>
                    ) : null}
                  </ReadValue>
                )}
              </Field>

              <Field label={`${labels.arrival} – ${labels.departure}`}>
                {editing && canRelocate ? (
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
                        selected={{ from: isoToDate(start), to: isoToDate(end) }}
                        onSelect={(range) => {
                          if (!range?.from) return
                          const s = dateToIso(range.from)
                          const e = range.to ? dateToIso(range.to) : s
                          setStart(s)
                          setEnd(e !== s ? e : addDays(s, 1))
                          if (range.to && dateToIso(range.to) !== s) setPickerOpen(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                ) : editing && canExtend ? (
                  // Joylashgan mehmon: FAQAT chiqish kuni. Bitta sanali picker — "kirishni ham
                  // o'zgartirsam bo'ladimi?" degan savol umuman tug'ilmasin.
                  <div className="flex flex-col gap-1.5">
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-9 justify-start gap-2 font-normal">
                          <CalendarPlus className="text-neutral-500" />
                          <span className="tabular-nums">
                            {labels.departure}: {fmtDay(end, labels)}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          locale={uz}
                          defaultMonth={isoToDate(end)}
                          selected={isoToDate(end)}
                          // Kamida bir kecha qolsin va o'tmishga tortilmasin.
                          disabled={{ before: isoToDate(addDays(start < today ? today : start, 1)) }}
                          onSelect={(d) => {
                            if (!d) return
                            setEnd(dateToIso(d))
                            setPickerOpen(false)
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-xs text-neutral-500">{labels.lockedHint}</span>
                  </div>
                ) : (
                  <StayCard
                    arrivalLabel={labels.arrival}
                    departureLabel={labels.departure}
                    arrival={fmtLongDate(b.start, labels)}
                    departure={fmtLongDate(b.end, labels)}
                    arrivalTime={labels.checkInTime}
                    departureTime={labels.checkOutTime}
                  />
                )}
              </Field>

              {conflict && <p className="text-xs font-medium text-destructive">{labels.conflict}</p>}
            </div>
          </Section>

          <Section icon={<Wallet className="size-3.5" />} title={labels.payment}>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={labels.amount}>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
                  {suggested != null && suggested !== amountNum && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(suggested))}
                      // Neytral: input ostidagi qizil matn validatsiya XATOSIdek o'qiladi, bu esa
                      // shunchaki maslahat. Brend rangi faqat hover'da — interaktivligini bildiradi.
                      className="self-start text-xs font-medium text-neutral-500 underline-offset-2 transition-colors hover:text-brand-700 hover:underline"
                    >
                      {labels.nightlyRate} {labels.money(editRoom?.rate ?? 0)} × {nights} = {labels.money(suggested)}
                    </button>
                  )}
                </Field>
                <Field label={labels.paid}>
                  <Input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="numeric" />
                  {paidNum > amountNum && (
                    <span className="text-xs font-medium text-destructive">{labels.prepaymentTooBig}</span>
                  )}
                </Field>
              </div>
            ) : payment ? (
              <div className="rounded-card bg-neutral-50 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-neutral-500">{labels.total}</span>
                  <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                    {labels.money(payment.paid)}
                    <span className="font-normal text-neutral-400"> / {labels.money(payment.total)}</span>
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={cn("h-full rounded-full transition-[width]", ratio >= 1 ? "bg-success" : "bg-warning")}
                    style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                  />
                </div>
                {remaining > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">{labels.remaining}</span>
                    <span className="font-semibold text-warning tabular-nums">{labels.money(remaining)}</span>
                  </div>
                )}
                {viewRoom?.rate != null && (
                  <p className="mt-2.5 text-xs text-neutral-500 tabular-nums">
                    {labels.nightlyRate} {labels.money(viewRoom.rate)} × {nights}
                  </p>
                )}
              </div>
            ) : (
              <ReadValue muted>—</ReadValue>
            )}
          </Section>

          <Section icon={<StickyNote className="size-3.5" />} title={labels.note}>
            {editing ? (
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={labels.notePlaceholder}
                rows={2}
              />
            ) : (
              <ReadValue muted={!b.note}>{b.note || "—"}</ReadValue>
            )}
          </Section>
        </div>

        {/* ── O'ng ustun: tarix + harakatlar ──────────────────────────────── */}
        {/* Ajratuvchi chiziq YO'Q — design.md: avval sirt kontrasti (bg-neutral-50), chiziq faqat
            boshqa iloji bo'lmaganda. Mobil (ustma-ust) va desktop (yonma-yon) ikkalasida ishlaydi. */}
        <aside className="app-scroll flex flex-col gap-6 bg-neutral-50 p-6 md:overflow-y-auto">
          <Section title={labels.history}>
            <ol className="flex flex-col gap-3">
              <TimelineRow done label={labels.historyCreated} at={fmtMoment(b.createdAt, labels)} />
              <TimelineRow
                done={b.checkedInAt != null}
                label={labels.historyCheckedIn}
                at={fmtMoment(b.checkedInAt, labels)}
              />
              <TimelineRow
                done={b.checkedOutAt != null}
                label={labels.historyCheckedOut}
                at={fmtMoment(b.checkedOutAt, labels)}
              />
            </ol>
          </Section>

          {!editing && (
            <Section title={labels.actions}>
              <div className="flex flex-col gap-2">
                {b.status === "booked" && (
                  <Button size="lg" className="rounded-control" disabled={busy} onClick={() => run(onCheckIn)}>
                    <LogIn /> {labels.checkIn}
                  </Button>
                )}
                {b.status === "checked_in" && (
                  <Button size="lg" className="rounded-control" disabled={busy} onClick={() => run(onCheckOut)}>
                    <LogOut /> {labels.checkOut}
                  </Button>
                )}

                {/* Ikkilamchi amallar — bron yopilgan bo'lsa ham ishlaydi (suhbat tarixi va
                    qaytib keluvchi mehmon uchun nusxalash aynan shunda kerak bo'ladi). */}
                {onOpenChat && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-control"
                    onClick={() => onOpenChat(b)}
                  >
                    <MessageSquare /> {labels.openChat}
                  </Button>
                )}
                {onDuplicate && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-control"
                    onClick={() => onDuplicate(b)}
                  >
                    <Copy /> {labels.duplicate}
                  </Button>
                )}

                {b.status === "booked" && (
                  <Button
                    size="lg"
                    variant="ghost"
                    className="rounded-control text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => run(onCancel)}
                  >
                    {labels.cancel}
                  </Button>
                )}
              </div>
            </Section>
          )}
        </aside>
      </div>

      {/* ── Tahrir footer'i ──────────────────────────────────────────────── */}
      {editing && (
        <footer className="hairline-t flex items-center justify-end gap-2 px-6 py-4">
          {!dirty && <span className="mr-auto text-xs text-neutral-400">{labels.noChanges}</span>}
          <Button variant="ghost" onClick={discard} disabled={busy}>
            {labels.discard}
          </Button>
          <Button onClick={save} disabled={!valid || !dirty || busy} className={cn(busy && "opacity-70")}>
            {labels.save}
          </Button>
        </footer>
      )}
    </div>
  )
}

/**
 * Mehmon qatori — ko'rish holatida bir qator, tahrirda o'sha joyda ochiladi. Asosiy mehmon
 * belgilanadi va o'chirilmaydi: bron ustunlari (mehmon QR kaliti) unga bog'langan, server ham
 * o'chirishga yo'l qo'ymaydi — UI shu qoidani oldindan ko'rsatadi.
 */
function GuestRow({
  guest: g,
  labels,
  disabled,
  onSave,
  onRemove,
  onMakePrimary,
}: {
  guest: CalendarGuest
  labels: CalendarLabels
  disabled?: boolean
  onSave?: (patch: Partial<CalendarGuestInput>) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  onMakePrimary?: () => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fullName, setFullName] = useState(g.fullName)
  const [phone, setPhone] = useState(g.phone ?? "")
  const [docType, setDocType] = useState(g.docType ?? "")
  const [docNumber, setDocNumber] = useState(g.docNumber ?? "")

  const run = async (fn?: () => void | Promise<void>) => {
    if (!fn || busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-card bg-neutral-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={labels.guestName} />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder={labels.guestPhone}
          />
        </div>
        <div className="mt-2">
          <DocFields
            labels={labels}
            docType={docType}
            docNumber={docNumber}
            onDocType={setDocType}
            onDocNumber={setDocNumber}
          />
        </div>
        <div className="mt-2.5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
            {labels.discard}
          </Button>
          <Button
            size="sm"
            disabled={busy || fullName.trim().length === 0}
            onClick={async () => {
              await run(() =>
                onSave?.({
                  fullName: fullName.trim(),
                  phone: phone.trim(),
                  docType: docType || undefined,
                  docNumber: docNumber.trim(),
                }),
              )
              setEditing(false)
            }}
          >
            {labels.save}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-neutral-50">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
          g.isPrimary ? "bg-brand-100 text-brand-800" : "bg-neutral-100 text-neutral-500",
        )}
      >
        {initials(g.fullName)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-900">
          {g.fullName}
          {g.isPrimary && (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[0.625rem] font-medium text-brand-800">
              {labels.primaryGuest}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-neutral-500 tabular-nums">
          {g.phone || "—"}
          {g.docType && (
            <span className="text-neutral-400">
              {" · "}
              {labels.docTypeText[g.docType] ?? g.docType}
              {g.docNumber ? ` ${g.docNumber}` : ""}
            </span>
          )}
        </p>
      </div>

      {/* Amallar hover'da chiqadi — 5 mehmonli ro'yxat 15 ta tugmaga aylanib ketmasin. */}
      {!disabled && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {!g.isPrimary && onMakePrimary && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={labels.makePrimary}
              aria-label={labels.makePrimary}
              disabled={busy}
              onClick={() => run(onMakePrimary)}
            >
              <Star />
            </Button>
          )}
          {onSave && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={labels.edit}
              aria-label={labels.edit}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
          )}
          {!g.isPrimary && onRemove && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={labels.removeGuest}
              aria-label={labels.removeGuest}
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => run(onRemove)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Yangi hamroh — ro'yxat oxirida ochiladigan qator (alohida oyna emas). */
function NewGuestRow({
  labels,
  onCancel,
  onSave,
}: {
  labels: CalendarLabels
  onCancel: () => void
  onSave: (guest: CalendarGuestInput) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [docType, setDocType] = useState("")
  const [docNumber, setDocNumber] = useState("")

  return (
    <div className="rounded-card bg-neutral-50 p-3 ring-1 ring-brand-200">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          autoFocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={labels.guestName}
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder={labels.guestPhone}
        />
      </div>
      <div className="mt-2">
        <DocFields
          labels={labels}
          docType={docType}
          docNumber={docNumber}
          onDocType={setDocType}
          onDocNumber={setDocNumber}
        />
      </div>
      <div className="mt-2.5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          <X /> {labels.close}
        </Button>
        <Button
          size="sm"
          disabled={busy || fullName.trim().length === 0}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave({
                fullName: fullName.trim(),
                ...(phone.trim() ? { phone: phone.trim() } : {}),
                ...(docType ? { docType } : {}),
                ...(docNumber.trim() ? { docNumber: docNumber.trim() } : {}),
              })
            } finally {
              setBusy(false)
            }
          }}
        >
          <Check /> {labels.save}
        </Button>
      </div>
    </div>
  )
}
