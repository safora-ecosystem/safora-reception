import { useEffect, useState } from "react"


export interface CalendarMetrics {
  railWidth: number
  rowHeight: number
  headerHeight: number
  dayScale: number
}

const COMFORTABLE: CalendarMetrics = { railWidth: 200, rowHeight: 52, headerHeight: 118, dayScale: 1 }
const COZY: CalendarMetrics = { railWidth: 172, rowHeight: 46, headerHeight: 110, dayScale: 0.86 }
const COMPACT: CalendarMetrics = { railWidth: 140, rowHeight: 42, headerHeight: 88, dayScale: 0.75 }

function tierForWidth(w: number): CalendarMetrics {
  if (w >= 1600) return COMFORTABLE
  if (w >= 1280) return COZY
  return COMPACT
}

function rootScale(): number {
  if (typeof document === "undefined") return 1
  const px = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(px) && px > 0 ? px / 16 : 1
}

function scaleMetrics(m: CalendarMetrics, k: number): CalendarMetrics {
  if (k === 1) return m
  return {
    railWidth: Math.round(m.railWidth * k),
    rowHeight: Math.round(m.rowHeight * k),
    headerHeight: Math.round(m.headerHeight * k),
    dayScale: m.dayScale * k,
  }
}

export function useCalendarMetrics(ref: React.RefObject<HTMLElement | null>): CalendarMetrics {
  const [metrics, setMetrics] = useState<CalendarMetrics>(() =>
    scaleMetrics(tierForWidth(typeof window === "undefined" ? 1600 : window.innerWidth - 256), rootScale()),
  )

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w == null) return
      const next = scaleMetrics(tierForWidth(w), rootScale())
      setMetrics((prev) =>
        prev.railWidth === next.railWidth && prev.rowHeight === next.rowHeight ? prev : next,
      )
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [ref])

  return metrics
}
