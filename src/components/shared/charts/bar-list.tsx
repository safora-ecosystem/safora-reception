import { cn } from "@/lib/utils"
import { ChartEmpty } from "@/components/shared/charts/chart-parts"
import { CHART_PRIMARY, barFill, fullNumber } from "@/components/shared/charts/chart-tokens"


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
  if (items.length === 0) return <ChartEmpty label={emptyLabel} className={className} />

  const sorted = [...items].sort((a, b) => b.value - a.value)
  const rows =
    limit && sorted.length > limit
      ? [
          ...sorted.slice(0, limit),
          {
            key: "__rest",
            label: "Boshqalar",
            value: sorted.slice(limit).reduce((sum, r) => sum + r.value, 0),
            caption: `${sorted.length - limit} ta`,
          } satisfies BarListItem,
        ]
      : sorted

  const top = Math.max(maxValue ?? 0, ...rows.map((r) => r.value), 1)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {rows.map((row) => (
        <div key={row.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-neutral-700">
              {row.label}
              {row.caption && (
                <span className="ml-1.5 text-xs text-neutral-400">{row.caption}</span>
              )}
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-900">
              {row.display ?? fullNumber(row.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${row.value > 0 ? Math.max((row.value / top) * 100, 2) : 0}%`,
                // Gorizontal ustunda gradient ham gorizontal: 8px balandlikda vertikal
                // o'tish umuman ko'rinmasdi.
                backgroundImage: barFill(row.color ?? CHART_PRIMARY, "to right"),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
