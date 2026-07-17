import { memo } from "react"
import { MoneyBag01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import { epochDay, nightsBetween, type BarRect } from "./geometry"
import type { CalendarBooking, CalendarLabels, CalendarPayment, StatusVisual } from "./types"


const BAR_VPAD = 5

interface CalendarBarProps {
  booking: CalendarBooking
  rect: BarRect
  rowTop: number
  rowHeight: number
  visual: StatusVisual
  labels: CalendarLabels
  today: string
  onSelect: (booking: CalendarBooking) => void
}

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

function paymentRatio(p: CalendarPayment): number {
  if (p.total > 0) return Math.max(0, Math.min(1, p.paid / p.total))
  return p.paid > 0 ? 1 : 0
}

/** To'lov indikatori — pul qopi glifi to'langan foizga proporsional to'ladi, holatiga qarab rangli. */
function PaymentGlyph({ payment }: { payment: CalendarPayment }) {
  const ratio = paymentRatio(payment)
  const fill = ratio >= 1 ? "text-success" : "text-warning"
  return (
    <span className="relative inline-block size-4 shrink-0" aria-hidden>
      <Icon icon={MoneyBag01Icon} className="absolute inset-0 size-4 opacity-35" strokeWidth={1.75} />
      {ratio > 0 && (
        <span className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: `${ratio * 100}%` }}>
          <Icon icon={MoneyBag01Icon} className={cn("absolute bottom-0 left-0 size-4", fill)} strokeWidth={1.75} />
        </span>
      )}
    </span>
  )
}

function CalendarBarImpl({ booking, rect, rowTop, rowHeight, visual, labels, today, onSelect }: CalendarBarProps) {
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
      onClick={() => onSelect(booking)}
      title={title}
      aria-label={title}
      className={cn(
        "absolute z-10 flex items-center gap-1.5 overflow-hidden rounded-[7px] px-2 text-left text-[0.75rem] font-medium transition-[filter,background-color] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
        visual.bar,
        visual.text,
        rect.clippedStart && "rounded-l-none",
        rect.clippedEnd && "rounded-r-none",
        overdue && "ring-2 ring-warning ring-inset",
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
