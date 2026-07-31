import { memo, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  BAR_RADIUS,
  BAR_VPAD,
  barShapePath,
  barSlant,
  epochDay,
  nightsBetween,
  type BarRect,
} from "./geometry"
import type { CalendarMoveHandlers } from "./use-calendar-move"
import type { CalendarTooltipHandlers } from "./use-calendar-tooltip"
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
  tooltip?: CalendarTooltipHandlers
  enterDelay?: number | null
}

const BAR_ENTER_FROM = { opacity: 0, filter: "blur(6px)" }
const BAR_ENTER_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1]
const BAR_ENTER_DURATION = 0.28

const ICON_MIN_PX = 60
const PAYMENT_MIN_PX = 108

function fmtDay(iso: string, labels: CalendarLabels): string {
  return labels.formatDay(iso)
}

function paymentRatio(p: CalendarPayment): number {
  if (p.total > 0) return Math.max(0, Math.min(1, p.paid / p.total))
  return p.paid > 0 ? 1 : 0
}

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

/**
 * Korporativ bron belgisi — to'lov glifining O'RNIGA chiqadi.
 *
 * Sabab operatsion, bezak emas: korporativ bronda `paid = 0` va `$` glifi bo'sh turardi, ya'ni
 * bar "qarzdor mehmon" bo'lib ko'rinardi. Xodim esa aynan shunday bar'larda pul so'raydi —
 * mahsulotning va'dasi buziladi. Bino belgisi "buning hisobi kompaniyada" deb turadi.
 */
function CorporateGlyph() {
  return (
    <span className="inline-flex size-4 shrink-0 items-center justify-center opacity-70" aria-hidden>
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2.5 14V3.2c0-.4.3-.7.7-.7h5.6c.4 0 .7.3.7.7V14M10.5 14V7h2.8c.4 0 .7.3.7.7V14M1 14h14" strokeLinecap="round" />
        <path d="M4.8 5.5h1.4M4.8 8h1.4M4.8 10.5h1.4" strokeLinecap="round" />
      </svg>
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
  tooltip,
  enterDelay = null,
}: CalendarBarProps) {
  // Kirish MOUNT'da muzlatiladi. Ota qayta render bo'lganda (culling bandi almashsa, tanlov yoki
  // filtr o'zgarsa) `enterDelay` null'ga aylanadi — agar shunga qarab `motion.button` ⇄ `button`
  // almashsa, React elementni unmount/remount qilib titratardi. Muzlatilgach bar o'z hayoti
  // davomida bitta turda qoladi.
  const [entry] = useState(() => enterDelay)
  const entering = entry != null
  const nights = nightsBetween(booking.start, booking.end)
  // Amber diqqat konturi ikki operatsion og'riqqa: (1) ichkarida, chiqish kuni o'tgan;
  // (2) kelishi kerak edi, kelmagan (no-show nomzodi — bekor qilinsin yoki kiritilsin).
  const overdue =
    (booking.status === "checked_in" && epochDay(booking.end) < epochDay(today)) ||
    (booking.status === "booked" && epochDay(booking.start) < epochDay(today))
  const barHeight = rowHeight - 2 * BAR_VPAD
  const showIcon = rect.width >= ICON_MIN_PX
  const corporate = booking.organization != null
  const showPayment = booking.payment != null && !corporate && rect.width >= PAYMENT_MIN_PX
  const showCorporate = corporate && rect.width >= PAYMENT_MIN_PX
  const StatusIcon = visual.icon

  const slant = barSlant(barHeight, rect.width)
  // Kontur qalinligi diqqat holatlarida ikki barobar — ichki shakl shunga qarab kichrayadi.
  const strokeWidth = selected || overdue ? 2 : 1
  const clipPath = barShapePath(rect.width, barHeight, slant, BAR_RADIUS, rect.clippedStart, rect.clippedEnd)
  // Ichki (fill) qatlam har tomondan `strokeWidth`cha kichik. Qiyalik ham shu nisbatda kichrayadi,
  // aks holda ichki qiya qirra tashqisiga parallel chiqmay kontur uchlarda yo'g'onlashardi.
  const innerH = Math.max(barHeight - 2 * strokeWidth, 0)
  const innerClipPath = barShapePath(
    Math.max(rect.width - 2 * strokeWidth, 0),
    innerH,
    barHeight > 0 ? (slant * innerH) / barHeight : slant,
    BAR_RADIUS - strokeWidth,
    rect.clippedStart,
    rect.clippedEnd,
  )
  // Kontent qiya uchga urilmasin: matn vertikal markazda tursa ham ikonka bar balandligini
  // deyarli to'ldiradi, shuning uchun bo'shliq qiyalikning katta qismicha bo'lishi kerak.
  const inset = Math.round(slant * 0.75) + 6


  const title =
    `${booking.label} · ${fmtDay(booking.start, labels)} – ${fmtDay(booking.end, labels)} · ${labels.nights(nights)}` +
    (booking.payment
      ? ` · ${labels.money(booking.payment.paid)} / ${labels.money(booking.payment.total)}`
      : "")

  return (
    <motion.button
      type="button"
      // `initial={false}` = animatsiyasiz bar'ga framer umuman style yozmaydi (oddiy button bilan
      // bir xil). Kirayotgan bar'da esa oxirgi opacity DIMMED holatini ham hisobga oladi: inline
      // style klassdan ustun turadi, aks holda qidiruvga mos kelmagan yangi bron to'liq yorqin
      // bo'lib qolardi.
      initial={entering ? BAR_ENTER_FROM : false}
      animate={entering ? { opacity: dimmed ? 0.25 : 1, filter: "blur(0px)" } : undefined}
      transition={
        entering ? { duration: BAR_ENTER_DURATION, delay: entry, ease: BAR_ENTER_EASE } : undefined
      }
      // Sudrash tugagach keladigan `click`ni yutamiz — aks holda ko'chirish ustiga detal
      // modali ham ochilardi. Klaviatura (Enter) hech qachon sudramaydi → doim ochiladi.
      onClick={() => {
        tooltip?.hide()
        if (move?.consumeClick()) return
        onSelect(booking)
      }}
      // Handler'lar HAR bar'ga ulanadi, faqat ko'chiriladiganlarga emas: hook o'zi statusga
      // qarab to'xtaydi, lekin pointerdown har jestda klik-bayrog'ini tozalashi kerak.
      onPointerDown={(e) => {
        tooltip?.hide() // sudrash/tanlashda tooltip yo'lda turmasin
        move?.start(e, booking)
      }}
      onPointerMove={move?.move}
      onPointerUp={move?.finish}
      onPointerCancel={move?.cancel}
      // Custom tooltip — kursor o'rni + bar chegarasini beramiz (touch'da hover yo'q → chiqmaydi).
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        tooltip?.show(booking, { x: e.clientX, top: r.top, bottom: r.bottom })
      }}
      onMouseLeave={() => tooltip?.hide()}
      aria-label={title}
      className={cn(
        // cursor-pointer: bron BOSILADIGAN (detal ochiladi) → hover'da pointer. Ko'chiriladigan bron
        // sudralayotganda (active) grabbing bo'ladi; native default/pointer kursorlarga tegilmaydi.
        "absolute z-10 flex cursor-pointer items-stretch transition-[filter] duration-150 ease-out",
        "hover:z-20 focus-visible:z-20 focus-visible:outline-none",
        // Kontur qatlami — BITTA bg klassi bo'lishi shart (ikkitasi bo'lsa CSS tartibi hal qilardi).
        // Variantli klasslar (hover/focus) Tailwind stylesheet'ida keyin turadi → ular ustun keladi.
        selected ? "z-30 bg-brand-500" : overdue ? "bg-warning" : visual.border,
        "focus-visible:bg-brand-500",
        // touch-none: touch/pen'da sudrash gestini brauzer scroll uchun o'g'irlamasin (ko'chirish ishlasin).
        movable && "touch-none active:cursor-grabbing",
        dimmed && "opacity-25",
      )}
      style={{
        left: rect.left,
        width: rect.width,
        top: rowTop + BAR_VPAD,
        height: barHeight,
        clipPath,
        // Kontur qalinligi = padding. Diqqat holatlarida qalinroq (ring o'rnini bosadi).
        padding: strokeWidth,
      }}
    >
      {/* Fill + kontent — ism CHAPDA (native <button> markazlashni meros oladi → text-left SHART).
          Ikonka ism yonida, to'lov glifi oxirida; ikkalasi ham tor bar'da yashiriladi.
          O'z clip-path'i bor: kontur qatlami ostidan chiqib ketmasin. */}
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left text-[0.8125rem] leading-none font-medium",
          visual.bar,
          visual.text,
        )}
        style={{ clipPath: innerClipPath, paddingLeft: inset, paddingRight: inset }}
      >
        {showIcon && StatusIcon && (
          <StatusIcon className={cn("size-4 shrink-0", overdue && "text-warning")} />
        )}
        <span className="min-w-0 truncate">{booking.label}</span>
        {showCorporate && <CorporateGlyph />}
        {showPayment && booking.payment && <PaymentGlyph payment={booking.payment} />}
      </span>
    </motion.button>
  )
}

export const CalendarBar = memo(CalendarBarImpl)
