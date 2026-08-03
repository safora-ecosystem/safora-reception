import { useMemo, useState } from "react"
import { CalendarDays, DoorOpen, Scissors } from "lucide-react"
import { uz } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MoneyInput } from "@/components/shared/money-input"
import { cn } from "@/lib/utils"
import { addDays, epochDay, hasConflict, nightsBetween } from "./geometry"
import { Field } from "./modal-parts"
import type { CalendarBooking, CalendarLabels, CalendarRoom, CalendarSplitInput } from "./types"


interface CalendarSplitDialogProps {
  booking: CalendarBooking | null
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  labels: CalendarLabels
  today: string
  onClose: () => void
  onSubmit: (input: CalendarSplitInput) => void | Promise<void>
}

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00`)
const dateToIso = (d: Date) => d.toLocaleDateString("en-CA")
const maxIso = (a: string, b: string) => (epochDay(a) >= epochDay(b) ? a : b)

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

export function CalendarSplitDialog(props: CalendarSplitDialogProps) {
  const { booking, onClose } = props
  return (
    <Dialog open={booking != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {/* key = bron id: boshqa bronga o'tilganda forma toza boshlanadi. */}
        {booking && <SplitBody key={booking.id} {...props} booking={booking} />}
      </DialogContent>
    </Dialog>
  )
}

function SplitBody({
  booking: b,
  rooms,
  bookings,
  labels,
  today,
  onClose,
  onSubmit,
}: CalendarSplitDialogProps & { booking: CalendarBooking }) {
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const nights = nightsBetween(b.start, b.end)
  const tooShort = nights < 2

  // Ko'chish kuni yashash ICHIDA qat'iy: chegaraga teng bo'lsa qismlardan biri nol kechali
  // bo'lardi. Mehmon ichkarida bo'lsa o'tgan kecha ham qulf — u kecha allaqachon o'sha xonada
  // o'tgan (server ham shuni rad etadi).
  const minDate = b.status === "checked_in" ? maxIso(addDays(b.start, 1), today) : addDays(b.start, 1)
  const maxDate = addDays(b.end, -1)
  const [splitDate, setSplitDate] = useState(() => {
    if (epochDay(today) < epochDay(minDate)) return minDate
    if (epochDay(today) > epochDay(maxDate)) return maxDate
    return today
  })

  const total = b.payment?.total ?? 0
  const firstNights = nightsBetween(b.start, splitDate)
  const secondNights = nightsBetween(splitDate, b.end)

  // Summa kechalar bo'yicha — resepshn kalkulyator qidirmasin. Sana o'zgarganda qayta
  // hisoblanadi, LEKIN xodim qo'lda tekkan bo'lsa tegilmaydi (`touched`).
  const [touched, setTouched] = useState(false)
  const suggested = nights > 0 ? Math.round((total * secondNights) / nights) : 0
  const [secondAmount, setSecondAmount] = useState(String(suggested))
  const effectiveSecond = touched ? Number(secondAmount.replace(/\s/g, "")) : suggested
  const firstAmount = Math.round((total - effectiveSecond) * 100) / 100

  // Xona ro'yxati: joriy xona chiqmaydi (o'ziga ko'chirish ma'nosiz), band bo'lganlar esa
  // ko'rinadi-yu tanlanmaydi — "nega bu xona yo'q?" degan savol tug'ilmasin.
  const options = useMemo(
    () =>
      rooms
        .filter((r) => r.id !== b.roomId)
        .map((r) => ({
          room: r,
          busy: hasConflict({ roomId: r.id, start: splitDate, end: b.end }, bookings, b.id),
        })),
    [rooms, b.roomId, b.id, b.end, splitDate, bookings],
  )

  // `undefined`, bo'sh satr EMAS: Radix Select'da `""` — "tanlovni tozalash" uchun ajratilgan
  // qiymat, uni boshlang'ich holat sifatida berish cheksiz render siklini keltirib chiqaradi.
  const [roomId, setRoomId] = useState<string | undefined>(undefined)
  const selected = options.find((o) => o.room.id === roomId)
  // Sana o'zgarib tanlangan xona band bo'lib qolishi mumkin — tanlovni JIMGINA tozalamaymiz,
  // ogohlantiramiz (xodim o'zi qaror qilsin: sanani qaytarish yoki boshqa xona).
  const roomBusy = selected?.busy === true

  const amountValid =
    Number.isFinite(effectiveSecond) && effectiveSecond >= 0 && effectiveSecond <= total
  const valid = !tooShort && roomId != null && !roomBusy && amountValid && !busy

  const submit = async () => {
    if (!valid || roomId == null) return
    setBusy(true)
    try {
      await onSubmit({
        splitDate,
        roomId,
        // Summasiz bron (payment yo'q) — serverga summa yubormaymiz, u o'zi taqsimlaydi.
        ...(b.payment ? { totalAmount: effectiveSecond } : {}),
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const currentRoom = rooms.find((r) => r.id === b.roomId)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Scissors className="size-4 text-neutral-500" />
          {labels.splitTitle}
        </DialogTitle>
        <DialogDescription>{labels.splitHint}</DialogDescription>
      </DialogHeader>

      {tooShort ? (
        <p className="rounded-card bg-warning-surface p-3.5 text-sm text-warning-surface-foreground">
          {labels.splitTooShort}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={labels.splitDate}>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-9 justify-start gap-2 font-normal">
                    <CalendarDays className="text-neutral-500" />
                    <span className="tabular-nums">{fmtDay(splitDate, labels)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    locale={uz}
                    defaultMonth={isoToDate(splitDate)}
                    selected={isoToDate(splitDate)}
                    disabled={{ before: isoToDate(minDate), after: isoToDate(maxDate) }}
                    onSelect={(d) => {
                      if (!d) return
                      setSplitDate(dateToIso(d))
                      setPickerOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field label={labels.splitRoom}>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={labels.roomSearch} />
                </SelectTrigger>
                {/* `popper`, item-aligned EMAS: Radix'ning default rejimi tanlangan qatorni
                    trigger ostiga TEKISLASH uchun kontent o'lchamini layout-effekt ichida
                    o'lchaydi va tuzatadi — 40 xonali, hech biri tanlanmagan ro'yxatda bu
                    o'lchov barqarorlashmay cheksiz render siklini beradi. Popper rejimi
                    o'lchamaydi (oddiy anchor) va uzun ro'yxat uchun baribir to'g'ri xulq. */}
                <SelectContent position="popper">
                  {options.map(({ room, busy: taken }) => (
                    <SelectItem key={room.id} value={room.id} disabled={taken}>
                      {room.label}
                      {room.sublabel ? ` · ${room.sublabel}` : ""}
                      {taken ? ` — ${labels.busy}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Natija OLDINDAN ko'rinadi: xodim "Bo'lish" ni bosishdan oldin ikkala qismni
              ham ko'radi (qaysi xona, qaysi kunlar, qancha pul). */}
          <div className="grid gap-2 sm:grid-cols-2">
            <PartCard
              title={labels.splitFirst}
              room={currentRoom?.label ?? "—"}
              range={`${fmtDay(b.start, labels)} – ${fmtDay(splitDate, labels)}`}
              nights={labels.nights(firstNights)}
              amount={b.payment ? labels.money(firstAmount) : null}
            />
            <PartCard
              title={labels.splitSecond}
              room={selected?.room.label ?? "—"}
              range={`${fmtDay(splitDate, labels)} – ${fmtDay(b.end, labels)}`}
              nights={labels.nights(secondNights)}
              amount={b.payment ? labels.money(effectiveSecond) : null}
              accent
            />
          </div>

          {b.payment && (
            <Field label={`${labels.splitSecond} · ${labels.amount}`}>
              <MoneyInput
                value={touched ? secondAmount : String(suggested)}
                onChange={(v) => {
                  setTouched(true)
                  setSecondAmount(v)
                }}
                ariaLabel={labels.amount}
                invalid={!amountValid}
              />
              <span className="text-xs text-neutral-500 tabular-nums">
                {labels.total} {labels.money(total)}
              </span>
            </Field>
          )}

          {roomBusy && <p className="text-xs font-medium text-destructive">{labels.splitBusy}</p>}
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
        <Button onClick={submit} disabled={!valid} className={cn(busy && "opacity-70")}>
          <Scissors /> {labels.confirmSplit}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Bo'linishdan keyingi bitta qism — xona, kunlar, kechalar, summa. */
function PartCard({
  title,
  room,
  range,
  nights,
  amount,
  accent,
}: {
  title: string
  room: string
  range: string
  nights: string
  amount: string | null
  /** Ikkinchi qism (yangi xona) brend ohangida — ko'z avval o'zgarishga tushsin. */
  accent?: boolean
}) {
  return (
    <div className={cn("rounded-card p-3.5", accent ? "bg-brand-50" : "bg-neutral-50")}>
      <p className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">{title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
        <DoorOpen className="size-3.5 shrink-0 text-neutral-400" />
        {room}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
        {range} · {nights}
      </p>
      {amount != null && (
        <p className="mt-1.5 text-sm font-semibold text-neutral-900 tabular-nums">{amount}</p>
      )}
    </div>
  )
}
