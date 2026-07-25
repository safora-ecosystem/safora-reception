import { memo } from "react"
import { cn } from "@/lib/utils"
import { BAR_VPAD, barClipPath, epochDay, nightsBetween, type BarRect } from "./geometry"
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
  const barHeight = rowHeight - 2 * BAR_VPAD

  // Ikki qatlam (tape-chart bar): TASHQI = chegara rangi + diagonal shakl, ICHKI = fill (1px inset).
  // clip-path CSS border'ni ham, ring'ni ham diagonal uchda kesib tashlaydi — shuning uchun chegara
  // shu inset mexanizmi orqali beriladi va u qiya uchni ham to'g'ri qamrab, shaklga MOS 1px chiziq
  // chizadi. Tanlangan (brand) / overdue (amber) holatida chegara 2px va urg'uli rangda.
  const emphasize = selected || overdue
  const inset = emphasize ? 2 : 1
  const outerClip = barClipPath(rect.width, barHeight, rect.clippedStart, rect.clippedEnd)
  const innerClip = barClipPath(
    rect.width - 2 * inset,
    barHeight - 2 * inset,
    rect.clippedStart,
    rect.clippedEnd,
  )
  // Tanlangan = brand (design.md: "aktiv holat = brand"), overdue = amber (semantik), aks holda status chegarasi.
  const borderBg = selected ? "bg-brand-500" : overdue ? "bg-warning" : visual.border

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
        // Tashqi = chegara qatlami. Klaviatura fokusi clip ostida ring bermaydi → chegara brand bo'ladi.
        "absolute z-10 overflow-hidden rounded-[7px] transition-[opacity] focus-visible:bg-brand-500 focus-visible:outline-none",
        borderBg,
        // touch-none: touch/pen'da sudrash gestini brauzer scroll uchun o'g'irlamasin (ko'chirish ishlasin).
        movable && "cursor-grab touch-none active:cursor-grabbing",
        dimmed && "opacity-25",
        selected && "z-20",
        rect.clippedStart && "rounded-l-none",
        rect.clippedEnd && "rounded-r-none",
      )}
      style={{
        left: rect.left,
        width: rect.width,
        top: rowTop + BAR_VPAD,
        height: barHeight,
        clipPath: outerClip || undefined,
      }}
    >
      {/* Ichki fill — ism CHAPDA. `text-left` SHART: native <button> UA-default `text-align: center`
          ni meros qiladi, uni bosmasak ism markazда qoladi (justify emas, TEXT-ALIGN masalasi).
          To'lov glifi ism YONIDA (o'ng chekkaga surilmaydi) — flex oqimida, gap bilan. */}
      <span
        className={cn(
          "absolute flex items-center gap-1.5 overflow-hidden rounded-[6px] pr-2.5 pl-3.5 text-left text-[0.8125rem] font-medium transition-[filter,background-color]",
          visual.bar,
          visual.text,
        )}
        style={{
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          clipPath: innerClip || undefined,
        }}
      >
        <span className="min-w-0 truncate">{booking.label}</span>
        {showPayment && booking.payment && <PaymentGlyph payment={booking.payment} />}
      </span>
    </button>
  )
}

export const CalendarBar = memo(CalendarBarImpl)
