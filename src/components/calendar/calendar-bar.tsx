import { memo } from "react"
import { cn } from "@/lib/utils"
import { BAR_VPAD, epochDay, nightsBetween, type BarRect } from "./geometry"
import type { CalendarMoveHandlers } from "./use-calendar-move"
import type { CalendarBooking, CalendarLabels, CalendarPayment, StatusVisual } from "./types"


interface CalendarBarProps {
  booking: CalendarBooking
  rect: BarRect
  rowTop: number
  rowHeight: number
  visual: StatusVisual
  labels: CalendarLabels
  today: string
  selected: boolean
  onSelect: (booking: CalendarBooking) => void
  movable?: boolean
  dimmed?: boolean
  move?: CalendarMoveHandlers
}

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

function paymentRatio(p: CalendarPayment): number {
  if (p.total > 0) return Math.max(0, Math.min(1, p.paid / p.total))
  return p.paid > 0 ? 1 : 0
}

/** To'lov indikatori — `$` belgisi to'langan foizga proporsional (pastdan) to'ladi, holatiga
    qarab rangli (to'liq=yashil, qisman=amber, to'lanmagan=quyi/xira). Bar matn rangini meros oladi. */
function PaymentGlyph({ payment }: { payment: CalendarPayment }) {
  const ratio = paymentRatio(payment)
  const fill = ratio >= 1 ? "text-success" : "text-warning"
  return (
    <span className="relative inline-block size-4 shrink-0 text-[0.8125rem] leading-none font-bold" aria-hidden>
      <span className="absolute inset-0 flex items-center justify-center opacity-30">$</span>
      {ratio > 0 && (
        <span className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: `${ratio * 100}%` }}>
          <span className={cn("absolute bottom-0 left-0 flex size-4 items-center justify-center", fill)}>$</span>
        </span>
      )}
    </span>
  )
}

function CalendarBarImpl({
  booking,
  rect,
  rowTop,
  rowHeight,
  visual,
  labels,
  today,
  selected,
  onSelect,
  movable = false,
  dimmed = false,
  move,
}: CalendarBarProps) {
  const nights = nightsBetween(booking.start, booking.end)
  const overdue = booking.status === "checked_in" && epochDay(booking.end) < epochDay(today)
  const showPayment = booking.payment != null && rect.width >= 64

  const title =
    `${booking.label} · ${fmtDay(booking.start, labels)} – ${fmtDay(booking.end, labels)} · ${labels.nights(nights)}` +
    (booking.payment
      ? ` · ${labels.money(booking.payment.paid)} / ${labels.money(booking.payment.total)}`
      : "")

  return (
    <button
      type="button"
      // Sudrash tugagach keladigan `click`ni yutamiz — aks holda ko'chirish ustiga detal
      // modali ham ochilardi. Klaviatura (Enter) hech qachon sudramaydi → doim ochiladi.
      onClick={() => {
        if (move?.consumeClick()) return
        onSelect(booking)
      }}
      // Handler'lar HAR bar'ga ulanadi, faqat ko'chiriladiganlarga emas: hook o'zi statusga
      // qarab to'xtaydi, lekin pointerdown har jestda klik-bayrog'ini tozalashi kerak.
      onPointerDown={move ? (e) => move.start(e, booking) : undefined}
      onPointerMove={move?.move}
      onPointerUp={move?.finish}
      onPointerCancel={move?.cancel}
      title={title}
      aria-label={title}
      className={cn(
        "absolute z-10 flex items-center gap-1.5 overflow-hidden rounded-[7px] px-2 text-left text-[0.75rem] font-medium transition-[filter,background-color,opacity] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
        visual.bar,
        visual.text,
        movable && "cursor-grab active:cursor-grabbing",
        dimmed && "opacity-25",
        rect.clippedStart && "rounded-l-none",
        rect.clippedEnd && "rounded-r-none",
        overdue && "ring-2 ring-warning ring-inset",
        selected && "z-20 ring-2 ring-neutral-900/40 ring-inset",
      )}
      style={{
        left: rect.left,
        width: rect.width,
        top: rowTop + BAR_VPAD,
        height: rowHeight - 2 * BAR_VPAD,
      }}
    >
      <span className="min-w-0 flex-1 truncate">{booking.label}</span>
      {showPayment && booking.payment && <PaymentGlyph payment={booking.payment} />}
    </button>
  )
}

export const CalendarBar = memo(CalendarBarImpl)
