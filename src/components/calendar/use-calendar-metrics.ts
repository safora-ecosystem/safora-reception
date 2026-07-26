import { useEffect, useState } from "react"


export interface CalendarMetrics {
  railWidth: number
  rowHeight: number
  headerHeight: number
  dayScale: number
}

const COMFORTABLE: CalendarMetrics = { railWidth: 200, rowHeight: 52, headerHeight: 104, dayScale: 1 }
const COZY: CalendarMetrics = { railWidth: 172, rowHeight: 46, headerHeight: 100, dayScale: 0.86 }
const COMPACT: CalendarMetrics = { railWidth: 140, rowHeight: 42, headerHeight: 84, dayScale: 0.75 }

function tierForWidth(w: number): CalendarMetrics {
  if (w >= 1600) return COMFORTABLE
  if (w >= 1280) return COZY
  return COMPACT
}

export function useCalendarMetrics(ref: React.RefObject<HTMLElement | null>): CalendarMetrics {
  const [metrics, setMetrics] = useState<CalendarMetrics>(() =>
    tierForWidth(typeof window === "undefined" ? 1600 : window.innerWidth - 256),
  )

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w == null) return
      const next = tierForWidth(w)
      setMetrics((prev) => (prev.railWidth === next.railWidth ? prev : next))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [ref])

  return metrics
}
