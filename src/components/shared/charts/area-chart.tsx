import { useState, type PointerEvent } from "react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ChartEmpty, ChartTooltip } from "@/components/shared/charts/chart-parts"
import {
  useChartSize,
  type ChartSeries,
  type TooltipRow,
} from "@/components/shared/charts/chart-hooks"
import {
  CHART_GRID,
  CHART_SURFACE,
  compactNumber,
  fullNumber,
  niceScale,
  seriesColor,
} from "@/components/shared/charts/chart-tokens"


export type AreaPoint = {
  key: string
  label: string
  full?: string
  values: Record<string, number>
}

type AreaChartProps = {
  data: AreaPoint[]
  series: ChartSeries[]
  format?: (value: number) => string
  tickFormat?: (value: number) => string
  labelEvery?: number
  maxValue?: number
  fill?: boolean
  emptyLabel?: string
  className?: string
  ariaLabel?: string
}

const PAD = { top: 10, right: 8, bottom: 22, left: 38 }
const TICKS = 4

export function AreaChart({
  data,
  series,
  format = fullNumber,
  tickFormat = compactNumber,
  labelEvery,
  maxValue,
  fill = true,
  emptyLabel,
  className,
  ariaLabel,
}: AreaChartProps) {
  const t = useT()
  const [box, size] = useChartSize<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  if (data.length === 0) return <ChartEmpty label={emptyLabel} className={className} />

  const peak = Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)))
  const { top, ticks } = niceScale(maxValue ?? peak, TICKS)

  const plotW = Math.max(0, size.width - PAD.left - PAD.right)
  const plotH = Math.max(0, size.height - PAD.top - PAD.bottom)
  const ready = plotW > 4 && plotH > 4

  const xAt = (i: number) =>
    PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const yAt = (v: number) => PAD.top + plotH - (v / top) * plotH

  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 8))
  const activeDatum = active !== null ? data[active] : null

  function locate(event: PointerEvent<HTMLDivElement>) {
    if (!ready) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left - PAD.left
    const step = data.length === 1 ? 1 : plotW / (data.length - 1)
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(x / step))))
  }

  return (
    <div className={cn("flex min-h-24 flex-col", className)}>
      <div
        ref={box}
        className="relative min-h-24 flex-1 focus-visible:outline-none"
        role="img"
        aria-label={ariaLabel ?? t("charts.line")}
        onPointerMove={locate}
        onPointerLeave={() => setActive(null)}
      >
        {ready && (
          <svg
            width={size.width}
            height={size.height}
            className="absolute inset-0 overflow-visible"
            aria-hidden
          >
            <defs>
              {series.map((s, si) => (
                <linearGradient key={s.key} id={`sfa-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color ?? seriesColor(si)} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={s.color ?? seriesColor(si)} stopOpacity={0.01} />
                </linearGradient>
              ))}
            </defs>

            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={size.width - PAD.right}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                  stroke={CHART_GRID}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={yAt(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-neutral-400 text-[10px] tabular-nums"
                >
                  {tickFormat(tick)}
                </text>
              </g>
            ))}

            {data.map((datum, i) =>
              i % every === 0 || i === data.length - 1 ? (
                <text
                  key={datum.key}
                  x={xAt(i)}
                  y={size.height - 6}
                  textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                  className="fill-neutral-400 text-[10px] tabular-nums"
                >
                  {datum.label}
                </text>
              ) : null,
            )}

            {active !== null && (
              <line
                x1={xAt(active)}
                x2={xAt(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke={CHART_GRID}
                strokeWidth={1}
              />
            )}

            {series.map((s, si) => {
              const points = data.map((d, i) => ({ x: xAt(i), y: yAt(d.values[s.key] ?? 0) }))
              const color = s.color ?? seriesColor(si)
              const line = smoothPath(points)
              return (
                <g key={s.key}>
                  {fill && points.length > 1 && (
                    <path
                      d={`${line} L ${points[points.length - 1].x} ${PAD.top + plotH} L ${points[0].x} ${PAD.top + plotH} Z`}
                      fill={`url(#sfa-${s.key})`}
                    />
                  )}
                  <path
                    d={line}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Oxirgi nuqta doim belgilanadi — chiziq qayerda tugaganini o'qish uchun. */}
                  <circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r={4}
                    fill={color}
                    stroke={CHART_SURFACE}
                    strokeWidth={2}
                  />
                  {active !== null && active !== points.length - 1 && (
                    <circle
                      cx={points[active].x}
                      cy={points[active].y}
                      r={4.5}
                      fill={color}
                      stroke={CHART_SURFACE}
                      strokeWidth={2}
                    />
                  )}
                </g>
              )
            })}
          </svg>
        )}

        {activeDatum && ready && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: xAt(active as number),
              // Eng yuqoridagi faol nuqta ustida — quticha hech qachon chiziqni bosmaydi.
              bottom:
                size.height -
                Math.min(...series.map((s) => yAt(activeDatum.values[s.key] ?? 0))),
            }}
          >
            <ChartTooltip
              title={activeDatum.full ?? activeDatum.label}
              align={
                (active as number) / Math.max(1, data.length - 1) < 0.15
                  ? "start"
                  : (active as number) / Math.max(1, data.length - 1) > 0.85
                    ? "end"
                    : "center"
              }
              rows={series.map<TooltipRow>((s, si) => ({
                label: s.label,
                value: format(activeDatum.values[s.key] ?? 0),
                color: s.color ?? seriesColor(si),
              }))}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Monoton kubik (Fritsch–Carlson) — silliq, LEKIN ma'lumotdan oshib ketmaydigan egri.
 * Oddiy Catmull-Rom chiroyli ko'rinadi-yu, ikki nuqta orasida mavjud bo'lmagan cho'qqi chizadi
 * (nol bandlikni manfiyga tushiradi) — grafik ma'lumotni yolg'on ko'rsatishi mumkin emas.
 */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2)
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  const n = points.length
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    slope.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x || 1))
  }

  const tangent: number[] = new Array(n)
  tangent[0] = slope[0]
  tangent[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      tangent[i] = ((3 * a) / h) * slope[i]
      tangent[i + 1] = ((3 * b) / h) * slope[i]
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = points[i].x + dx[i] / 3
    const c1y = points[i].y + (tangent[i] * dx[i]) / 3
    const c2x = points[i + 1].x - dx[i] / 3
    const c2y = points[i + 1].y - (tangent[i + 1] * dx[i]) / 3
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${points[i + 1].x} ${points[i + 1].y}`
  }
  return d
}
