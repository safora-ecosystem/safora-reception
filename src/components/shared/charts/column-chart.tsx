import { useState } from "react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ChartEmpty, ChartTooltip } from "@/components/shared/charts/chart-parts"
import {
  useKeyboardCursor,
  type ChartSeries,
  type TooltipRow,
} from "@/components/shared/charts/chart-hooks"
import {
  CHART_GRID,
  barFill,
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
  color?: string
}

type ColumnChartProps = {
  data: ColumnDatum[]
  series: ChartSeries[]
  format?: (value: number) => string
  tickFormat?: (value: number) => string
  labelEvery?: number
  showEmphasisValue?: boolean
  maxValue?: number
  reference?: { value: number; label: string }
  emptyLabel?: string
  className?: string
  ariaLabel?: string
}

function maxBarFor(count: number): number {
  if (count <= 8) return 56
  if (count <= 14) return 44
  return 36
}
const MIN_BAR_HEIGHT = 10
const TICKS = 4

function axisWidthFor(labels: string[]): number {
  return Math.max(30, Math.max(...labels.map((l) => l.length)) * 6 + 10)
}

export function ColumnChart({
  data,
  series,
  format = fullNumber,
  tickFormat = compactNumber,
  labelEvery,
  showEmphasisValue = false,
  maxValue,
  reference,
  emptyLabel,
  className,
  ariaLabel,
}: ColumnChartProps) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  const cursor = useKeyboardCursor(data.length, setHover)
  const active = hover ?? cursor.index

  if (data.length === 0) return <ChartEmpty label={emptyLabel} className={className} />

  const peak = Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)), maxValue ?? 0)
  const drop = Math.max(0, ...data.flatMap((d) => series.map((s) => -(d.values[s.key] ?? 0))))
  const { top, ticks } = niceScale(maxValue ?? Math.max(peak, reference?.value ?? 0), TICKS)
  const { top: floor, ticks: floorTicks } = drop > 0 ? niceScale(drop, 2) : { top: 0, ticks: [] }
  const span = top + floor
  const zeroPct = span > 0 ? (floor / span) * 100 : 0
  const posOf = (value: number) => zeroPct + (span > 0 ? (value / span) * 100 : 0)
  const tickLabels = ticks.map(tickFormat)
  const floorLabels = floorTicks.filter((v) => v > 0).map((v) => tickFormat(-v))
  const axisWidth = axisWidthFor([...tickLabels, ...floorLabels])

  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 12))

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex min-h-0 flex-1">
        {}
        <div className="relative shrink-0" style={{ width: axisWidth }}>
          {ticks.map((tick, i) => (
            <span
              key={tick}
              className="absolute right-1.5 translate-y-1/2 text-[0.625rem] whitespace-nowrap tabular-nums text-neutral-400"
              style={{ bottom: `${posOf(tick)}%` }}
            >
              {tickLabels[i]}
            </span>
          ))}
          {floorTicks
            .filter((v) => v > 0)
            .map((tick) => (
              <span
                key={`-${tick}`}
                className="absolute right-1.5 translate-y-1/2 text-[0.625rem] whitespace-nowrap tabular-nums text-neutral-400"
                style={{ bottom: `${posOf(-tick)}%` }}
              >
                {tickFormat(-tick)}
              </span>
            ))}
        </div>

        <div
          className="relative min-h-24 min-w-0 flex-1 focus-visible:outline-none"
          role="img"
          aria-label={ariaLabel ?? t("charts.column")}
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
              style={{ bottom: `${posOf(tick)}%`, borderColor: CHART_GRID }}
            />
          ))}
          {floorTicks
            .filter((v) => v > 0)
            .map((tick) => (
              <div
                key={`-${tick}`}
                aria-hidden
                className="absolute inset-x-0 border-t"
                style={{ bottom: `${posOf(-tick)}%`, borderColor: CHART_GRID }}
              />
            ))}
          {/* NOL chizig'i — ustunlar unga tayanadi, ya'ni u setkaning bir qadam quyuqrog'i.
              Faqat pastki yarim BOR bo'lganda chiziladi: bir tomonlama grafikda nol chizig'i
              plotning pastki chekkasi bilan ustma-ust tushadi va ikkinchi chiziq bo'lib
              ko'rinardi. */}
          {floor > 0 && (
            <div
              aria-hidden
              className="absolute inset-x-0 border-t"
              style={{ bottom: `${zeroPct}%`, borderColor: "var(--color-neutral-300)" }}
            />
          )}

          {reference && reference.value > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 flex items-center"
              style={{ bottom: `${posOf(reference.value)}%` }}
            >
              <div
                className="h-0 flex-1 border-t border-dashed"
                style={{ borderColor: "var(--color-neutral-400)" }}
              />
              {/* Yorliq chiziqning USTIDA, o'ng chekkada: chiziq ustida yotsa oxirgi ustunlarni
                  yopardi, ostida yotsa 0 chizig'iga yaqin holatda o'q belgilariga tegardi. */}
              <span className="ml-2 -translate-y-1/2 rounded bg-card/85 px-1 text-[0.6875rem] whitespace-nowrap text-neutral-500 tabular-nums">
                {reference.label}
              </span>
            </div>
          )}

          <div className="absolute inset-0 flex">
            {data.map((datum, index) => {
              const isActive = active === index
              // Belgi eng baland MUSBAT ustunning tepasida turadi (manfiy ustun nol chizig'idan
              // pastda, ya'ni belgi u yerda ma'lumotni yopmaydi).
              const tallest = posOf(Math.max(0, ...series.map((s) => datum.values[s.key] ?? 0)))
              const align = index / Math.max(1, data.length - 1)

              /** Bir yarim — musbat (nol chizig'idan yuqoriga) yoki manfiy (pastga).
                  Ikkalasi ham HAMMA seriyani chizadi: ishorasi mos kelmagani 0 balandlik oladi,
                  shu sababli ustunlarning gorizontal tekislanishi ikki yarimda ham bir xil. */
              const half = (sign: 1 | -1, extent: number) => (
                <div
                  className={cn(
                    "absolute inset-x-0 flex justify-center gap-0.5 px-[6%]",
                    sign === 1 ? "items-end" : "items-start",
                  )}
                  style={
                    sign === 1
                      ? { top: 0, bottom: `${zeroPct}%` }
                      : { top: `${100 - zeroPct}%`, bottom: 0 }
                  }
                >
                  {series.map((s, si) => {
                    const value = datum.values[s.key] ?? 0
                    const shown = sign === 1 ? value > 0 : value < 0
                    const pct = shown && extent > 0 ? (Math.abs(value) / extent) * 100 : 0
                    return (
                      <div
                        key={s.key}
                        className={cn(
                          "min-w-0 flex-1 rounded-full transition-[filter]",
                          datum.planned && "bar-hatch",
                          isActive && "brightness-95",
                        )}
                        style={{
                          maxWidth: maxBarFor(data.length),
                          height: `${shown ? Math.max(pct, 1.5) : 0}%`,
                          // Nolga teng bo'lmagan qiymat KO'RINISHI shart: pill'ning eng kichik
                          // o'qiladigan shakli — doira. Undan pastda ustun chiziqqa aylanib,
                          // "bor" va "yo'q" farqi yo'qolardi.
                          minHeight: shown ? MIN_BAR_HEIGHT : 0,
                          // Rejadagi ustun SHTRIX bilan chiziladi (`bar-hatch`) — unga gradient
                          // berilmaydi, aks holda tekstura yuvilib, "amalda"dan farqi yo'qoladi.
                          // Rang IKKALA yarimda ham seriyaniki: ishorani joy aytadi, rang emas.
                          backgroundImage: datum.planned
                            ? undefined
                            : barFill(datum.color ?? s.color ?? seriesColor(si)),
                        }}
                      />
                    )
                  })}
                </div>
              )

              return (
                <div
                  key={datum.key}
                  className="relative min-w-0 flex-1"
                  onMouseEnter={() => setHover(index)}
                >
                  {/* Hover maydoni butun ustun bo'yi — nishon belgidan kattaroq bo'lishi kerak.
                      Yumaloq va uyaning ichiga kirgan: to'g'ri burchakli, uyani to'liq egallagan
                      dog' kartaning ichida begona to'rtburchak bo'lib o'qilardi. */}
                  <div
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 inset-x-[4%] rounded-lg transition-colors",
                      isActive && "bg-neutral-500/[0.07]",
                    )}
                  />

                  {/* Uyaning ~12% i havo bo'lib qoladi (qo'shnilar yopishmasin), qolganini
                      ustun oladi — `MAX_BAR` gacha. Pastki yarim FAQAT manfiy qiymat bo'lganda
                      chiziladi: usiz geometriya avvalgi bir tomonlama grafikning aynan o'zi. */}
                  {half(1, top)}
                  {floor > 0 && half(-1, floor)}

                  {/* To'g'ridan-to'g'ri belgi — tanlab: faqat "bugun" yoki hover'dagi ustun. */}
                  {showEmphasisValue && datum.emphasis && !isActive && series.length === 1 && (
                    <span
                      className="pointer-events-none absolute left-1/2 mb-1.5 -translate-x-1/2 text-[0.6875rem] font-semibold whitespace-nowrap text-neutral-900 tabular-nums"
                      style={{ bottom: `${tallest}%` }}
                    >
                      {format(datum.values[series[0].key] ?? 0)}
                    </span>
                  )}

                  {/* Quticha ustunning tepasiga EMAS, plotning tepasiga qadaladi. Ustun ustida
                      suzganda u qo'shni ustunlarni yopardi va sichqoncha ustunlar bo'ylab
                      yurganda yuqoriga-pastga sakrab, grafikni tinchsiz qilardi. Tepada esa
                      doim bo'sh havo bor (shkala cho'qqisi ma'lumotdan yuqori) — quticha
                      o'sha havoda turadi va hech qachon belgi ustiga tushmaydi. */}
                  {isActive && (
                    <div className="pointer-events-none absolute inset-x-0 top-0">
                      <ChartTooltip
                        title={datum.full ?? datum.label}
                        placement="below"
                        align={align < 0.15 ? "start" : align > 0.85 ? "end" : "center"}
                        rows={series.map<TooltipRow>((s, si) => ({
                          label: s.label,
                          value: format(datum.values[s.key] ?? 0),
                          color: datum.color ?? s.color ?? seriesColor(si),
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

      {/* X yorliqlari — yuqoridagi bilan bir xil bo'linish (o'q eni + flex-1), shuning uchun tekis. */}
      <div className="mt-2 flex">
        <div className="shrink-0" style={{ width: axisWidth }} aria-hidden />
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
