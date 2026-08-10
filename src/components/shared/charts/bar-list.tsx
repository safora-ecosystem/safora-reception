import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ChartEmpty } from "@/components/shared/charts/chart-parts"
import { CHART_PRIMARY, fullNumber } from "@/components/shared/charts/chart-tokens"


export type BarListItem = {
  key: string
  label: string
  value: number
  display?: string
  caption?: string
  color?: string
}

type BarListProps = {
  items: BarListItem[]
  maxValue?: number
  emptyLabel?: string
  className?: string
  limit?: number
}

export function BarList({ items, maxValue, emptyLabel, className, limit }: BarListProps) {
  const t = useT()
  if (items.length === 0) return <ChartEmpty label={emptyLabel} className={className} />

  const sorted = [...items].sort((a, b) => b.value - a.value)
  const rows =
    limit && sorted.length > limit
      ? [
          ...sorted.slice(0, limit),
          {
            key: "__rest",
            label: t("charts.others"),
            value: sorted.slice(limit).reduce((sum, r) => sum + r.value, 0),
            caption: t("charts.othersCount", { count: sorted.length - limit }),
          } satisfies BarListItem,
        ]
      : sorted

  const top = Math.max(maxValue ?? 0, ...rows.map((r) => r.value), 1)

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {rows.map((row) => {
        const pct = row.value > 0 ? Math.max((row.value / top) * 100, 1.5) : 0
        return (
          <div
            key={row.key}
            className="relative flex items-center justify-between gap-3 overflow-hidden rounded-control px-2.5 py-2"
          >
            {pct > 0 && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-control transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  // Matn ustida turadigan yuza — to'yingan ustun emas: 16% aralashma
                  // neutral-800 matn bilan 10:1 dan yuqori kontrastni saqlaydi.
                  background: `color-mix(in oklab, ${row.color ?? CHART_PRIMARY} 16%, transparent)`,
                }}
              />
            )}
            <span className="relative min-w-0 truncate text-sm text-neutral-800">
              {row.label}
              {row.caption && <span className="ml-1.5 text-xs text-neutral-500">{row.caption}</span>}
            </span>
            <span className="relative shrink-0 text-sm font-medium text-neutral-900 tabular-nums">
              {row.display ?? fullNumber(row.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
