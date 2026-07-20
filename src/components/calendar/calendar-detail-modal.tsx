import { useMemo, useState } from "react"
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  DoorOpen,
  LogIn,
  LogOut,
  Pencil,
  User,
  Wallet,
} from "lucide-react"
import { uz } from "date-fns/locale"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { hasConflict, nightsBetween } from "./geometry"
import type {
  BookingEditPatch,
  CalendarBooking,
  CalendarLabels,
  CalendarPayment,
  CalendarRoom,
  CalendarStatus,
} from "./types"


interface CalendarDetailModalProps {
  booking: CalendarBooking | null
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  labels: CalendarLabels
  onClose: () => void
  onCheckIn?: (id: string) => void | Promise<void>
  onCheckOut?: (id: string) => void | Promise<void>
  onCancel?: (id: string) => void | Promise<void>
  onEdit?: (id: string, patch: BookingEditPatch) => void | Promise<void>
}

const STATUS_CHIP: Record<CalendarStatus, string> = {
  booked: "bg-brand-100 text-brand-800",
  checked_in: "bg-success-surface text-success-surface-foreground",
  checked_out: "bg-neutral-100 text-neutral-500",
  cancelled: "bg-destructive-surface text-destructive-surface-foreground",
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

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  )
}

function ReadValue({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <p className={cn("text-sm font-medium", muted ? "text-neutral-400" : "text-neutral-900")}>{children}</p>
  )
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
  return (
    <Dialog open={booking != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {/* key = bron id: boshqa bronga o'tilganda tahrir holati toza boshlanadi. */}
        {booking && <DetailBody key={booking.id} {...props} booking={booking} />}
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({
  booking: b,
  rooms,
  bookings,
  labels,
  onClose,
  onCheckIn,
  onCheckOut,
  onCancel,
  onEdit,
}: CalendarDetailModalProps & { booking: CalendarBooking }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [guestName, setGuestName] = useState(b.label)
  const [guestPhone, setGuestPhone] = useState(b.sublabel ?? "")
  const [roomId, setRoomId] = useState(b.roomId)
  const [start, setStart] = useState(b.start)
  const [end, setEnd] = useState(b.end)
  const [amount, setAmount] = useState(String(b.payment?.total ?? 0))

  // Ko'chirish faqat kelmagan mehmon uchun — serverning aynan qoidasi (409 bo'lmasin).
  const canRelocate = b.status === "booked"
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
  const conflict = editing && canRelocate && hasConflict({ roomId, start, end }, bookings, b.id)

  const amountNum = Number(amount.replace(/\s/g, ""))
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0
  const phoneDigits = guestPhone.replace(/\D/g, "")
  const dirty =
    guestName.trim() !== b.label ||
    guestPhone.trim() !== (b.sublabel ?? "") ||
    roomId !== b.roomId ||
    start !== b.start ||
    end !== b.end ||
    amountNum !== (b.payment?.total ?? 0)
  const valid =
    guestName.trim().length > 0 && phoneDigits.length >= MIN_PHONE_DIGITS && nights >= 1 && amountValid && !conflict

  /** Xona narxi × kechalar — resepshn summani qo'lda hisoblamasin. */
  const suggested = editRoom?.rate != null ? Math.round(editRoom.rate * nights) : null

  const payment = b.payment
  const ratio = payment ? paymentRatio(payment) : 0
  const remaining = payment ? Math.max(0, payment.total - payment.paid) : 0

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
      if (end !== b.end) patch.end = end
    }
    if (amountNum !== (b.payment?.total ?? 0)) patch.totalAmount = amountNum

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
    setEditing(false)
  }

  return (
    <div className="flex max-h-[90vh] flex-col">
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
                  b.guestConfirmed ? "bg-success-surface text-success-surface-foreground" : "bg-neutral-100 text-neutral-500",
                )}
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
                          setEnd(e)
                          if (range.to && dateToIso(range.to) !== s) setPickerOpen(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="rounded-card bg-neutral-50 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
                          {labels.arrival}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                          {fmtLongDate(b.start, labels)}
                        </span>
                        <span className="text-xs text-neutral-500 tabular-nums">{labels.checkInTime}</span>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-neutral-300" />
                      <div className="flex flex-1 flex-col items-end gap-0.5 text-right">
                        <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
                          {labels.departure}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                          {fmtLongDate(b.end, labels)}
                        </span>
                        <span className="text-xs text-neutral-500 tabular-nums">{labels.checkOutTime}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Field>

              {editing && !canRelocate && <p className="text-xs text-neutral-500">{labels.lockedHint}</p>}
              {conflict && <p className="text-xs font-medium text-destructive">{labels.conflict}</p>}
            </div>
          </Section>

          <Section icon={<Wallet className="size-3.5" />} title={labels.payment}>
            {editing ? (
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
        </div>

        {/* ── O'ng ustun: tarix + harakatlar ──────────────────────────────── */}
        {/* Ajratuvchi chiziq YO'Q — design.md: avval sirt kontrasti (bg-neutral-50), chiziq faqat
            boshqa iloji bo'lmaganda. Mobil (ustma-ust) va desktop (yonma-yon) ikkalasida ishlaydi. */}
        <aside className="flex flex-col gap-6 bg-neutral-50 p-6 md:overflow-y-auto">
          <Section icon={null} title={labels.history}>
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

          {!editing && !isClosed && (
            <Section icon={null} title={labels.actions}>
              <div className="flex flex-col gap-2">
                {b.status === "booked" && (
                  <>
                    <Button size="lg" className="rounded-control" disabled={busy} onClick={() => run(onCheckIn)}>
                      <LogIn /> {labels.checkIn}
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      className="rounded-control text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => run(onCancel)}
                    >
                      {labels.cancel}
                    </Button>
                  </>
                )}
                {b.status === "checked_in" && (
                  <Button size="lg" className="rounded-control" disabled={busy} onClick={() => run(onCheckOut)}>
                    <LogOut /> {labels.checkOut}
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
