import { memo, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { CleanIcon, Note01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import {
  BAR_RADIUS,
  BAR_VPAD,
  barCornerRadius,
  nightsBetween,
  type BarRect,
} from "./geometry"
import type { CalendarMoveHandlers } from "./use-calendar-move"
import type { CalendarTooltipHandlers } from "./use-calendar-tooltip"
import type {
  CalendarBarMoney,
  CalendarBooking,
  CalendarLabels,
  CalendarPayment,
  StatusVisual,
} from "./types"


interface CalendarBarProps {
  booking: CalendarBooking
  rect: BarRect
  rowTop: number
  rowHeight: number
  visual: StatusVisual
  labels: CalendarLabels
  selected: boolean
  linked?: boolean
  onSelect: (booking: CalendarBooking) => void
  movable?: boolean
  dimmed?: boolean
  cleaning?: "dirty" | "in_progress" | "clean" | null
  move?: CalendarMoveHandlers
  tooltip?: CalendarTooltipHandlers
  barMoney?: CalendarBarMoney
  showGuestCount?: boolean
  enterDelay?: number | null
}

const BAR_ENTER_FROM = { opacity: 0, filter: "blur(6px)" }
const BAR_ENTER_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1]
const BAR_ENTER_DURATION = 0.28

const PAYMENT_MIN_PX = 108

const CORNER_BADGE_PX = 16
const CORNER_BADGE_OUT = BAR_VPAD
const BADGE_PAIR_MIN_PX = 2 * CORNER_BADGE_PX - 2 * CORNER_BADGE_OUT + 6
const CLEANING_LOOK = {
  dirty: "bg-warning",
  in_progress: "bg-brand-500",
  clean: "bg-success",
} as const

function CornerBadge({
  corner,
  className,
  children,
}: {
  corner: "tl" | "tr" | "br"
  className?: string
  children: ReactNode
}) {
  const top = corner !== "br"
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute flex items-center justify-center rounded-full ring-[1.5px] ring-card",
        className,
      )}
      style={{
        minWidth: CORNER_BADGE_PX,
        height: CORNER_BADGE_PX,
        top: top ? -CORNER_BADGE_OUT : undefined,
        bottom: top ? undefined : -CORNER_BADGE_OUT,
        left: corner === "tl" ? -CORNER_BADGE_OUT : undefined,
        right: corner === "tl" ? undefined : -CORNER_BADGE_OUT,
      }}
    >
      {children}
    </span>
  )
}

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
 * To'lov MATN ko'rinishi — `$` glifi o'rniga haqiqiy summa, qisqartirilgan ("1,2 mln").
 *
 * Ba'zi mehmonxonalar glifni emas, raqamni o'qiydi (founder, 2026-08-07) — bu ko'rinish
 * SOZLAMASI, default emas. Rang tili glif bilan BIR XIL qoladi: to'liq = yashil, qisman =
 * amber, to'lanmagan = meros rang xiraroq — xodim rejim almashtirsa ham signalni qayta
 * o'rganmaydi. `remaining` rejimida qiymat = qoldiq (amber "hali so'raladigan pul");
 * qoldiq nol bo'lgan bron bu funksiyaga KELMAYDI — u yashil glifga qaytadi (chaqiruvchida).
 *
 * Qoldiq MANFIY belgi bilan chiziladi ("−640 ming"). Bu arifmetik minus emas: ikki rejim
 * yonma-yon bir xil raqamday o'qilardi va xodim "640 ming to'langan"mi yoki "640 ming
 * qolgan"mi ekanini rejimni eslab turmasa ajratolmasdi. Minus — "hali shuncha olinadi"
 * signali (founder, 2026-08-08).
 */
function PaymentText({
  payment,
  mode,
  labels,
}: {
  payment: CalendarPayment
  mode: "total" | "remaining"
  labels: CalendarLabels
}) {
  const ratio = paymentRatio(payment)
  const value = mode === "remaining" ? Math.max(0, payment.total - payment.paid) : payment.total
  const tone =
    mode === "remaining"
      ? "text-warning"
      : ratio >= 1
        ? "text-success"
        : ratio > 0
          ? "text-warning"
          : "opacity-60"
  return (
    <span
      aria-hidden
      className={cn("shrink-0 text-[0.6875rem] leading-none font-semibold tabular-nums", tone)}
    >
      {mode === "remaining" ? "−" : ""}
      {labels.moneyShort(value)}
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
  selected,
  linked = false,
  onSelect,
  movable = false,
  dimmed = false,
  cleaning = null,
  move,
  tooltip,
  barMoney = "glyph",
  showGuestCount = true,
  enterDelay = null,
}: CalendarBarProps) {
  // Kirish MOUNT'da muzlatiladi. Ota qayta render bo'lganda (culling bandi almashsa, tanlov yoki
  // filtr o'zgarsa) `enterDelay` null'ga aylanadi — agar shunga qarab `motion.button` ⇄ `button`
  // almashsa, React elementni unmount/remount qilib titratardi. Muzlatilgach bar o'z hayoti
  // davomida bitta turda qoladi.
  const [entry] = useState(() => enterDelay)
  const entering = entry != null
  const nights = nightsBetween(booking.start, booking.end)
  const barHeight = rowHeight - 2 * BAR_VPAD
  const corporate = booking.organization != null
  const showPayment =
    booking.payment != null && !corporate && barMoney !== "hidden" && rect.width >= PAYMENT_MIN_PX
  const showCorporate = corporate && rect.width >= PAYMENT_MIN_PX
  // `remaining` rejimida qoldiqsiz bron yashil glifga QAYTADI: bo'sh joy "ma'lumot yo'q" deb
  // o'qilardi, to'liq yashil `$` esa "qarz yo'q" tasdig'i — xodim pul so'ramaydigan bar'ni
  // bir qarashda ajratadi.
  const remaining = booking.payment ? Math.max(0, booking.payment.total - booking.payment.paid) : 0
  const paymentAsText =
    barMoney === "total" || (barMoney === "remaining" && remaining > 0)

  // Kontur qalinligi tanlanganda ikki barobar — ichki radius konsentrik qoladi
  // (tashqi radius − stroke), aks holda kontur burchaklarda yo'g'onlashib ko'rinardi.
  // Ilgari "overdue" (kelmagan/chiqmagan) bron ham amber konturda ajratilardi — founder
  // (2026-07-31 kechqurun) olib tashlatdi: signal deb o'qilmay, bezakday turardi. Kechikkan
  // bronni endi chap burchakdagi son emas, detal oynasi/ro'yxatlar aytadi.
  const strokeWidth = selected || linked ? 2 : 1
  const borderRadius = barCornerRadius(BAR_RADIUS, rect.clippedStart, rect.clippedEnd)
  const innerRadius = barCornerRadius(BAR_RADIUS - strokeWidth, rect.clippedStart, rect.clippedEnd)
  // Kontent yumaloq burchakka urilmasin — radius'cha yon bo'shliq yetadi.
  const inset = BAR_RADIUS


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
      // Touch long-press "ko'tarish"da brauzer kontekst-menyusi ochilmasin (hook faqat touch
      // jestida to'sadi — sichqonchaning o'ng tugmasi odatdagidek ishlaydi).
      onContextMenu={move?.contextMenu}
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
        // Tanlangan — to'liq brend konturi; ZANJIRDOSH — bir pog'ona jimroq brend
        // (u javob, tanlov emas) + fill sal yorishadi.
        selected ? "z-30 bg-brand-500" : linked ? "z-20 bg-brand-300 brightness-110" : visual.border,
        "focus-visible:bg-brand-500",
        // touch-none: touch/pen'da sudrash gestini brauzer scroll uchun o'g'irlamasin (ko'chirish
        // ishlasin — scroll niyatini hook o'zi pan qilib beradi). select-none: long-press iOS'da
        // matn tanlash/callout ochmasin.
        movable && "touch-none select-none active:cursor-grabbing",
        dimmed && "opacity-25",
      )}
      style={{
        left: rect.left,
        width: rect.width,
        top: rowTop + BAR_VPAD,
        height: barHeight,
        borderRadius,
        // Kontur qalinligi = padding. Diqqat holatlarida qalinroq (ring o'rnini bosadi).
        padding: strokeWidth,
      }}
    >
      {/* Fill + kontent — ism CHAPDA (native <button> markazlashni meros oladi → text-left SHART).
          To'lov glifi oxirida, tor bar'da yashiriladi. O'z konsentrik radius'i bor: kontur
          qatlami ostidan chiqib ketmasin. */}
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left text-[0.8125rem] leading-none font-medium",
          visual.bar,
          visual.text,
        )}
        style={{ borderRadius: innerRadius, paddingLeft: inset, paddingRight: inset }}
      >
        <span className={cn("min-w-0 truncate", visual.labelClass)}>{booking.label}</span>
        {showCorporate && <CorporateGlyph />}
        {showPayment &&
          booking.payment &&
          (paymentAsText ? (
            <PaymentText
              payment={booking.payment}
              mode={barMoney as "total" | "remaining"}
              labels={labels}
            />
          ) : (
            <PaymentGlyph payment={booking.payment} />
          ))}
      </span>
      {/* Burchak badge'lari — ichki span'dan KEYIN (uning overflow-hidden'i kesmasin, ustida
          chizilsin). Oynadan kesilgan uchda chizilmaydi (clippedEnd/clippedStart): burchakning
          o'zi diapazon chegarasidan tashqarida — belgi yolg'on joyda suzardi. */}
      {cleaning && !rect.clippedEnd && (
        <CornerBadge corner="tr" className={cn("text-on-fill", CLEANING_LOOK[cleaning])}>
          {/* Ikonka = Hugeicons CleanIcon, sayt standarti stroke 1.5 (founder tanlovi,
              2026-08-01: hugeicons.com'dan ko'rsatib berdi — qo'lda chizilgan supurgilar bekor). */}
          <Icon icon={CleanIcon} className={cn("size-2.5 shrink-0", cleaning !== "clean" && "cal-sweep")} />
        </CornerBadge>
      )}
      {/* Mehmon soni — ikki xonali bo'lsa doira tabletkaga cho'ziladi (yon padding + minWidth),
          aks holda "12" doiradan chiqib ketardi. */}
      {showGuestCount &&
        (booking.guestCount ?? 0) > 1 &&
        !rect.clippedStart &&
        rect.width >= BADGE_PAIR_MIN_PX && (
          <CornerBadge
            corner="tl"
            className="bg-foreground text-background px-1 text-[0.625rem] leading-none font-semibold tabular-nums"
          >
            {booking.guestCount}
          </CornerBadge>
        )}
      {/* Eslatma belgisi — o'ng-QUYI burchak (yuqori-o'ng tozalashniki, ikkalasi birga
          sig'adi). Kesilgan uchda chizilmaydi — burchakning o'zi oynadan tashqarida. */}
      {!!booking.note && !rect.clippedEnd && (
        <CornerBadge corner="br" className="bg-foreground text-background">
          <Icon icon={Note01Icon} className="size-3 shrink-0" strokeWidth={2} />
        </CornerBadge>
      )}
    </motion.button>
  )
}

export const CalendarBar = memo(CalendarBarImpl)
