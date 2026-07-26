import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChartEmpty, ChartTooltip } from "@/components/shared/charts/chart-parts"
import {
  useKeyboardCursor,
  type ChartSeries,
  type TooltipRow,
} from "@/components/shared/charts/chart-hooks"
import {
  CHART_GRID,
  compactNumber,
  fullNumber,
  niceScale,
  seriesColor,
} from "@/components/shared/charts/chart-tokens"


export type { ChartSeries }

export type ColumnDatum = {
  key: string
  label: string
  full?: string
  values: Record<string, number>
  planned?: boolean
  emphasis?: boolean
}

type ColumnChartProps = {
  data: ColumnDatum[]
  series: ChartSeries[]
  format?: (value: number) => string
  tickFormat?: (value: number) => string
  labelEvery?: number
  showEmphasisValue?: boolean
  maxValue?: number
  emptyLabel?: string
  className?: string
  ariaLabel?: string
}

const MAX_BAR = 36
const MIN_BAR_HEIGHT = 10
const TICKS = 4

export function ColumnChart({
  data,
  series,
  format = fullNumber,
  tickFormat = compactNumber,
  labelEvery,
  showEmphasisValue = false,
  maxValue,
  emptyLabel,
  className,
  ariaLabel = "Ustunli diagramma",
}: ColumnChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const cursor = useKeyboardCursor(data.length, setHover)
  const active = hover ?? cursor.index

  if (data.length === 0) return <ChartEmpty label={emptyLabel} className={className} />

  const peak = Math.max(
    0,
    ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)),
    maxValue ?? 0,
  )
  const { top, ticks } = niceScale(maxValue ?? peak, TICKS)

  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 12))

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex min-h-0 flex-1">
        {}
        <div className="relative w-9 shrink-0">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-1.5 translate-y-1/2 text-[0.625rem] tabular-nums text-neutral-400"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {tickFormat(tick)}
            </span>
          ))}
        </div>

        <div
          className="relative min-h-24 min-w-0 flex-1 focus-visible:outline-none"
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={cursor.onKeyDown}
          onMouseLeave={() => setHover(null)}
          onBlur={() => cursor.setIndex(null)}
        >
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className="absolute inset-x-0 border-t"
              style={{ bottom: `${(tick / top) * 100}%`, borderColor: CHART_GRID }}
            />
          ))}

          <div className="absolute inset-0 flex">
            {data.map((datum, index) => {
              const isActive = active === index
              const barPercents = series.map((s) => ((datum.values[s.key] ?? 0) / top) * 100)
              const tallest = Math.max(0, ...barPercents)
              const align = index / Math.max(1, data.length - 1)

              return (
                <div
                  key={datum.key}
                  className="relative min-w-0 flex-1"
                  onMouseEnter={() => setHover(index)}
                >
                  {/* Hover maydoni butun ustun bo'yi — nishon belgidan kattaroq bo'lishi kerak. */}
                  <div
                    aria-hidden
                    className={cn(
                      "absolute inset-0 transition-colors",
                      isActive && "bg-neutral-100/70",
                    )}
                  />

                  {/* Uyaning ~12% i havo bo'lib qoladi (qo'shnilar yopishmasin), qolganini
                      ustun oladi — `MAX_BAR` gacha. */}
                  <div className="absolute inset-0 flex items-end justify-center gap-0.5 px-[6%]">
                    {series.map((s, si) => {
                      const value = datum.values[s.key] ?? 0
                      const pct = barPercents[si]
                      return (
                        <div
                          key={s.key}
                          className={cn(
                            "min-w-0 flex-1 rounded-full transition-[filter,background-color]",
                            datum.planned && "bar-hatch",
                            isActive && "brightness-95",
                          )}
                          style={{
                            maxWidth: MAX_BAR,
                            height: `${value > 0 ? Math.max(pct, 1.5) : 0}%`,
                            // Nolga teng bo'lmagan qiymat KO'RINISHI shart: pill'ning eng kichik
                            // o'qiladigan shakli — doira. Undan pastda ustun chiziqqa aylanib,
                            // "bor" va "yo'q" farqi yo'qolardi.
                            minHeight: value > 0 ? MIN_BAR_HEIGHT : 0,
                            backgroundColor: datum.planned
                              ? undefined
                              : (s.color ?? seriesColor(si)),
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* To'g'ridan-to'g'ri belgi — tanlab: faqat "bugun" yoki hover'dagi ustun. */}
                  {showEmphasisValue && datum.emphasis && !isActive && series.length === 1 && (
                    <span
                      className="pointer-events-none absolute left-1/2 mb-1.5 -translate-x-1/2 text-[0.6875rem] font-semibold whitespace-nowrap text-neutral-900 tabular-nums"
                      style={{ bottom: `${tallest}%` }}
                    >
                      {format(datum.values[series[0].key] ?? 0)}
                    </span>
                  )}

                  {isActive && (
                    <div
                      className="pointer-events-none absolute inset-x-0"
                      style={{ bottom: `${tallest}%` }}
                    >
                      <ChartTooltip
                        title={datum.full ?? datum.label}
                        align={align < 0.15 ? "start" : align > 0.85 ? "end" : "center"}
                        rows={series.map<TooltipRow>((s, si) => ({
                          label: s.label,
                          value: format(datum.values[s.key] ?? 0),
                          color: s.color ?? seriesColor(si),
                          hatch: datum.planned,
                        }))}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* X yorliqlari — yuqoridagi bilan bir xil bo'linish (w-9 + flex-1), shuning uchun tekis. */}
      <div className="mt-2 flex">
        <div className="w-9 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1">
          {data.map((datum, index) => (
            <span
              key={datum.key}
              className={cn(
                "min-w-0 flex-1 truncate text-center text-[0.6875rem] tabular-nums",
                datum.emphasis ? "font-semibold text-neutral-900" : "text-neutral-400",
              )}
            >
              {index % every === 0 || index === data.length - 1 || datum.emphasis ? datum.label : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
