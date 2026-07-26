import { memo } from "react"
import { cn } from "@/lib/utils"


interface CalendarGroupRowProps {
  rowTop: number
  height: number
  days: number
  dayWidth: number
  avail: Int16Array | null
  rate: number
}

function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function CalendarGroupRowImpl({ rowTop, height, days, dayWidth, avail, rate }: CalendarGroupRowProps) {
  const showRate = rate > 0 && dayWidth >= 44
  return (
    <div
      className="absolute left-0 flex"
      style={{ top: rowTop, height, width: days * dayWidth }}
      aria-hidden
    >
      {Array.from({ length: days }, (_, c) => {
        const free = avail ? avail[c] : null
        return (
          <div
            key={c}
            className="flex flex-col items-center justify-center gap-0.5"
            style={{ width: dayWidth }}
          >
            {free != null && (
              <span
                className={cn(
                  "text-[0.8125rem] font-semibold tabular-nums",
                  free <= 0 ? "text-destructive" : "text-neutral-700",
                )}
              >
                {Math.max(0, free)}
              </span>
            )}
            {showRate && (
              <span className="rounded-full border border-border bg-white px-1.5 py-px text-[0.6875rem] leading-tight font-medium text-neutral-500 tabular-nums">
                {compact(rate)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export const CalendarGroupRow = memo(CalendarGroupRowImpl)
