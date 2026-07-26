import { memo, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { isSundayColumn, isWeekendColumn } from "./geometry"


interface CalendarGridLayerProps {
  originDay: number
  days: number
  dayWidth: number
  bodyWidth: number
  todayCol: number
  pastCol: number
}

function CalendarGridLayerImpl({ originDay, days, dayWidth, bodyWidth, todayCol, pastCol }: CalendarGridLayerProps) {
  const weekendCols: number[] = []
  for (let c = 0; c < days; c++) if (isWeekendColumn(originDay, c)) weekendCols.push(c)

  const gridlines: CSSProperties = {
    backgroundImage: `repeating-linear-gradient(90deg, var(--color-neutral-200) 0, var(--color-neutral-200) 1px, transparent 1px, transparent ${dayWidth}px)`,
  }

  return (
    <div
      className="pointer-events-none sticky top-0 z-0 h-screen"
      style={{ width: bodyWidth }}
      aria-hidden
    >
      {/* Dam olish kunlari + bugun washlari (viewport balandligida, chiziqlar ostida) */}
      {weekendCols.map((c) => (
        <div
          key={c}
          className={cn("absolute inset-y-0", isSundayColumn(originDay, c) ? "bg-neutral-100" : "bg-neutral-50")}
          style={{ left: c * dayWidth, width: dayWidth }}
        />
      ))}
      {todayCol >= 0 && (
        <div className="absolute inset-y-0 bg-brand-50" style={{ left: todayCol * dayWidth, width: dayWidth }} />
      )}
      {/* O'tmish (bugundan oldingi kunlar) — bu yerga bron ochilmaydi. TEKIS, juda xira neytral
          wash (diagonal shtrix EMAS — u butun fonni "chizilgan"dek ko'rsatardi). Chiziqlar ostida. */}
      {pastCol > 0 && (
        <div
          className="absolute inset-y-0 bg-neutral-50"
          style={{ left: 0, width: Math.min(pastCol, days) * dayWidth }}
        />
      )}
      {/* Vertikal kun chiziqlari — washlar ustida */}
      <div className="absolute inset-0" style={gridlines} />
    </div>
  )
}

export const CalendarGridLayer = memo(CalendarGridLayerImpl)
