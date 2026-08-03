import { memo } from "react"
import { cn } from "@/lib/utils"


interface CalendarGroupRowProps {
  rowTop: number
  height: number
  dayWidth: number
  avail: Int16Array | null
  colLo: number
  colHi: number
  bodyWidth: number
}

function CalendarGroupRowImpl({
  rowTop,
  height,
  dayWidth,
  avail,
  colLo,
  colHi,
  bodyWidth,
}: CalendarGroupRowProps) {
  return (
    <div
      className="absolute left-0 border-t border-border bg-neutral-500/[0.06]"
      style={{ top: rowTop, height, width: bodyWidth }}
      aria-hidden
    >
      {avail != null &&
        Array.from({ length: Math.max(0, colHi - colLo) }, (_, i) => {
          const c = colLo + i
          const free = avail[c]
          return (
            <div
              key={c}
              className="absolute inset-y-0 flex items-center justify-center"
              style={{ left: c * dayWidth, width: dayWidth }}
            >
              <span
                className={cn(
                  "text-xs leading-none font-medium tabular-nums",
                  free <= 0 ? "text-destructive" : "text-neutral-500",
                )}
              >
                {Math.max(0, free)}
              </span>
            </div>
          )
        })}
    </div>
  )
}

export const CalendarGroupRow = memo(CalendarGroupRowImpl)
