import { useId, useState, type ReactNode } from "react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { arcTint, fullNumber, seriesColor } from "@/components/shared/charts/chart-tokens"


export type DonutSlice = {
  key: string
  label: string
  value: number
  color?: string
}

type DonutChartProps = {
  slices: DonutSlice[]
  centerValue?: ReactNode
  centerLabel?: string
  half?: boolean
  format?: (value: number) => string
  legend?: boolean
  className?: string
  ariaLabel?: string
}

const SIZE = 200
const STROKE = 26

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  half = false,
  format = fullNumber,
  legend = true,
  className,
  ariaLabel,
}: DonutChartProps) {
  const t = useT()
  const [active, setActive] = useState<string | null>(null)
  const gid = useId()

  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const radius = (SIZE - STROKE) / 2
  const center = SIZE / 2
  const sweep = half ? Math.PI : Math.PI * 2
  const startAngle = half ? Math.PI : -Math.PI / 2

  const drawn = total > 0 ? slices.filter((s) => s.value > 0) : []
  const gap = drawn.length > 1 ? 2 / radius : 0
  const cap = drawn.length > 1 ? ("butt" as const) : ("round" as const)

  let cursor = startAngle
  const arcs = drawn.map((slice, index) => {
    const fraction = slice.value / total
    const from = cursor + (index === 0 ? 0 : gap / 2)
    const to = cursor + fraction * sweep - (index === drawn.length - 1 ? 0 : gap / 2)
    cursor += fraction * sweep
    return { slice, from: Math.min(from, to), to, color: slice.color ?? seriesColor(index) }
  })

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="relative mx-auto w-full max-w-[220px]">
        <svg
          viewBox={half ? `0 0 ${SIZE} ${SIZE / 2 + STROKE / 2}` : `0 0 ${SIZE} ${SIZE}`}
          className="w-full"
          role="img"
          aria-label={ariaLabel ?? t("charts.donut")}
        >
          <defs>
            {arcs.map(({ slice, color }) => {
              const tint = arcTint(color)
              return (
                <linearGradient
                  key={slice.key}
                  id={`${gid}-${slice.key}`}
                  gradientUnits="userSpaceOnUse"
                  x1={0}
                  y1={0}
                  x2={0}
                  // Ramp KO'RINADIGAN balandlikka cho'ziladi, SVG kvadratiga emas: yarim
                  // donutning viewBox'i deyarli ikki barobar past, ya'ni 0→SIZE gradientning
                  // faqat yuqori yarmi ko'rinardi va ohang to'liq donutdagidan sust chiqardi.
                  y2={half ? SIZE / 2 + STROKE / 2 : SIZE}
                >
                  <stop offset="0%" stopColor={tint.light} />
                  <stop offset="100%" stopColor={tint.base} />
                </linearGradient>
              )
            })}
          </defs>
          {/* Yo'lak — to'ldirilmagan qism. Uchi bo'laklar bilan BIR XIL kesimda: yo'lak
              yumaloq, bo'laklar tekis bo'lsa, to'la to'ldirilgan halqaning ikki chekkasida
              kulrang dumaloq quloqchalar chiqib qolardi va ular "qolgan ulush" bo'lib
              o'qilardi — holbuki hech narsa qolmagan. */}
          <path
            d={arcPath(center, center, radius, startAngle, startAngle + sweep - 0.0001)}
            fill="none"
            stroke="var(--color-neutral-200)"
            strokeWidth={STROKE}
            strokeLinecap={half ? cap : "butt"}
          />
          {/* Bo'laklar burchak bo'yicha ajratilgan (`gap`) — orasidan yo'lak ko'rinib turadi.
              Ustidan qo'shimcha ajratkich CHIZIQ tortilmaydi: u yoyning yumaloq uchini kesib
              o'tib, halqa ustida oq qiyshiq iz qoldirardi. Ajratish — tirqish, chiziq emas. */}
          {arcs.map(({ slice, from, to }) => (
            <path
              key={slice.key}
              d={arcPath(center, center, radius, from, to)}
              fill="none"
              stroke={`url(#${gid}-${slice.key})`}
              strokeWidth={active && active !== slice.key ? STROKE - 4 : STROKE}
              strokeLinecap={cap}
              className="cursor-default transition-[stroke-width] duration-150"
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
            >
              <title>{`${slice.label} — ${format(slice.value)}`}</title>
            </path>
          ))}
        </svg>

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 flex flex-col items-center gap-0.5",
            half ? "bottom-0" : "top-1/2 -translate-y-1/2",
          )}
        >
          <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-neutral-900">
            {centerValue ?? format(total)}
          </span>
          {centerLabel && <span className="text-xs text-neutral-500">{centerLabel}</span>}
        </div>
      </div>

      {legend && slices.length > 1 && (
        <dl className={cn("grid gap-3", slices.length > 3 ? "grid-cols-2" : "grid-cols-3")}>
          {slices.map((slice, index) => (
            <div key={slice.key} className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color ?? seriesColor(index) }}
                />
                <span className="truncate">{slice.label}</span>
              </dt>
              <dd className="text-lg leading-none font-semibold tabular-nums text-neutral-900">
                {format(slice.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const x1 = cx + Math.cos(from) * r
  const y1 = cy + Math.sin(from) * r
  const x2 = cx + Math.cos(to) * r
  const y2 = cy + Math.sin(to) * r
  const large = to - from > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}
