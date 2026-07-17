import { memo } from "react"
import { cn } from "@/lib/utils"
import { dateForColumn, monthSegments } from "./geometry"
import type { CalendarLabels } from "./types"


const MONTH_STRIP = 22

interface CalendarHeaderProps {
  originDay: number
  days: number
  dayWidth: number
  bodyWidth: number
  headerHeight: number
  todayCol: number
  labels: CalendarLabels
}

function CalendarHeaderImpl({
  originDay,
  days,
  dayWidth,
  bodyWidth,
  headerHeight,
  todayCol,
  labels,
}: CalendarHeaderProps) {
  const months = monthSegments(originDay, days)

  return (
    <div className="hairline-b relative bg-white" style={{ width: bodyWidth, height: headerHeight }}>
      {}
      <div className="flex" style={{ height: MONTH_STRIP }}>
        {months.map((seg) => (
          <div
            key={`${seg.year}-${seg.month}`}
            className="hairline-b flex items-center overflow-hidden px-2 text-[0.6875rem] font-semibold whitespace-nowrap text-neutral-500"
            style={{ width: seg.span * dayWidth }}
          >
            <span className="truncate capitalize">
              {labels.months[seg.month]} {seg.year}
            </span>
          </div>
        ))}
      </div>

      {/* Kun kataklari */}
      <div className="flex" style={{ height: headerHeight - MONTH_STRIP }}>
        {Array.from({ length: days }, (_, c) => {
          const d = dateForColumn(originDay, c)
          const dow = d.getUTCDay()
          const isToday = c === todayCol
          return (
            <div
              key={c}
              className="flex flex-col items-center justify-center gap-0.5"
              style={{ width: dayWidth }}
            >
              <span
                className={cn(
                  "text-[0.625rem] font-medium tracking-wide uppercase",
                  isToday ? "text-brand-600" : "text-neutral-400",
                )}
              >
                {labels.weekdaysShort[dow]}
              </span>
              <span
                className={cn(
                  "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums",
                  isToday ? "bg-brand-500 text-white" : "text-neutral-700",
                )}
              >
                {d.getUTCDate()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const CalendarHeader = memo(CalendarHeaderImpl)
