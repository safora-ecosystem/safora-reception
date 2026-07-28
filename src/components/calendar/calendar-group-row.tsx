import { memo } from "react"
import { cn } from "@/lib/utils"


interface CalendarGroupRowProps {
  rowTop: number
  height: number
  dayWidth: number
  avail: Int16Array | null
  rate: number
  colLo: number
  colHi: number
  bodyWidth: number
}

function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function CalendarGroupRowImpl({
  rowTop,
  height,
  dayWidth,
  avail,
  rate,
  colLo,
  colHi,
  bodyWidth,
}: CalendarGroupRowProps) {
  const showRate = rate > 0 && dayWidth >= 44
  return (
    // `hairline-b`: qavat satri body tarafida ham pastdan yopiladi. Ilgari chiziq faqat reyd
    // tarafida bor edi (u yerda guruh kartasi o'z chegarasini chizardi), kunlar ustida esa qavat
    // satri quyidagi xona satriga chegarasiz qo'shilib ketib, "qavat chizig'i tushib qolgan"dek
    // ko'rinardi. Xona satrlarining chizig'i o'z catcher div'idan keladi.
    <div
      className="hairline-b absolute left-0"
      style={{ top: rowTop, height, width: bodyWidth }}
      aria-hidden
    >
      {Array.from({ length: Math.max(0, colHi - colLo) }, (_, i) => {
        const c = colLo + i
        const free = avail ? avail[c] : null
        return (
          <div
            key={c}
            className="absolute inset-y-0 flex flex-col items-center justify-center gap-0.5"
            style={{ left: c * dayWidth, width: dayWidth }}
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
