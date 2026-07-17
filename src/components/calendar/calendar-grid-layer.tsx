import { memo, type CSSProperties } from "react"
import { isSundayColumn, isWeekendColumn } from "./geometry"


interface CalendarGridLayerProps {
  originDay: number
  days: number
  dayWidth: number
  bodyWidth: number
  totalHeight: number
  todayCol: number
}

function CalendarGridLayerImpl({
  originDay,
  days,
  dayWidth,
  bodyWidth,
  totalHeight,
  todayCol,
}: CalendarGridLayerProps) {
  const weekendCols: number[] = []
  for (let c = 0; c < days; c++) if (isWeekendColumn(originDay, c)) weekendCols.push(c)

  const gridlines: CSSProperties = {
    backgroundImage: `repeating-linear-gradient(90deg, var(--color-neutral-200) 0, var(--color-neutral-200) 0.5px, transparent 0.5px, transparent ${dayWidth}px)`,
  }

  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: bodyWidth, height: totalHeight }}
      aria-hidden
    >
      {/* Dam olish kunlari + bugun tint'lari (chiziqlar ostida) */}
      {weekendCols.map((c) => (
        <div
          key={c}
          className={isSundayColumn(originDay, c) ? "absolute top-0 bg-neutral-100" : "absolute top-0 bg-neutral-50"}
          style={{ left: c * dayWidth, width: dayWidth, height: totalHeight }}
        />
      ))}
      {todayCol >= 0 && (
        <div
          className="absolute top-0 bg-brand-50"
          style={{ left: todayCol * dayWidth, width: dayWidth, height: totalHeight }}
        />
      )}
      {/* Vertikal kun chiziqlari — tint'lar ustida, doim ko'rinadi */}
      <div className="absolute inset-0" style={gridlines} />
    </div>
  )
}

export const CalendarGridLayer = memo(CalendarGridLayerImpl)
