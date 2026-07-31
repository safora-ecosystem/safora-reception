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
    // `border-y border-brand-300` — rail'dagi qavat tugmasining ayni romi body bo'ylab davom
    // etadi: qavat tasmasi butun timeline kengligida ikki uzluksiz brand chiziq bilan ajralib
    // turadi (tepa — oldingi qavatdan, past — o'z xonalaridan). Ilgari bu yerda hairline bor edi
    // va qavat satri xona satrlariga qo'shilib ketardi.
    // Qalinlik `calendar-rail.tsx` bilan BIR XIL bo'lishi shart — izohi o'sha yerda.
    <div
      className="absolute left-0 border-y border-brand-300"
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
