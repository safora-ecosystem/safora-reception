import { memo } from "react"
import { cn } from "@/lib/utils"
import { dateForColumn, monthSegments } from "./geometry"
import type { CalendarLabels } from "./types"


interface CalendarHeaderProps {
  originDay: number
  days: number
  dayWidth: number
  bodyWidth: number
  headerHeight: number
  railWidth: number
  todayCol: number
  labels: CalendarLabels
  occupancy: number[]
}

function CalendarHeaderImpl({
  originDay,
  days,
  dayWidth,
  bodyWidth,
  headerHeight,
  railWidth,
  todayCol,
  labels,
  occupancy,
}: CalendarHeaderProps) {
  const months = monthSegments(originDay, days)
  const compact = headerHeight < 92
  const monthStrip = compact ? 20 : 26

  return (
    <div className="hairline-b relative bg-white" style={{ width: bodyWidth, height: headerHeight }}>
      {}
      <div className="flex" style={{ height: monthStrip }}>
        {months.map((seg) => (
          <div
            key={`${seg.year}-${seg.month}`}
            className="hairline-b relative flex items-center"
            style={{ width: seg.span * dayWidth }}
          >
            <span
              className="sticky z-10 whitespace-nowrap bg-white py-0.5 pr-3 pl-2 text-[0.6875rem] font-semibold text-neutral-500 capitalize"
              style={{ left: railWidth }}
            >
              {labels.months[seg.month]} {seg.year}
            </span>
          </div>
        ))}
      </div>

      {/* Kun kataklari — hafta kuni · sana · bandlik % */}
      <div className="flex" style={{ height: headerHeight - monthStrip }}>
        {Array.from({ length: days }, (_, c) => {
          const d = dateForColumn(originDay, c)
          const dow = d.getUTCDay()
          const isToday = c === todayCol
          const occ = occupancy[c] ?? 0
          return (
            <div
              key={c}
              className={cn("flex flex-col items-center justify-center", compact ? "gap-0.5" : "gap-1")}
              style={{ width: dayWidth }}
            >
              <span
                className={cn(
                  "text-[0.6875rem] font-medium tracking-wide uppercase",
                  isToday ? "text-brand-600" : "text-neutral-400",
                )}
              >
                {labels.weekdaysShort[dow]}
              </span>
              <span
                className={cn(
                  "flex items-center justify-center rounded-full px-2 font-semibold tabular-nums leading-none",
                  compact ? "h-7 min-w-7 text-lg" : "h-9 min-w-9 text-2xl",
                  isToday ? "bg-brand-500 text-on-fill" : "text-neutral-800",
                )}
              >
                {d.getUTCDate()}
              </span>
              {/* Bandlik — emfaza EMAS: neytral matn, faqat yuqori bandlik biroz to'qroq. Bugun brand. */}
              <span
                className={cn(
                  "text-xs leading-none font-medium tabular-nums",
                  isToday ? "text-brand-600" : occ >= 90 ? "text-neutral-600" : "text-neutral-400",
                )}
              >
                {`${occ}%`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const CalendarHeader = memo(CalendarHeaderImpl)
