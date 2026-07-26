import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CalendarBooking } from "./types"


const OPEN_DELAY = 320
const CLOSE_GRACE = 90

export interface TooltipAnchor {
  x: number
  top: number
  bottom: number
}

export interface CalendarTooltipState {
  booking: CalendarBooking
  anchor: TooltipAnchor
}

export interface CalendarTooltipHandlers {
  show: (booking: CalendarBooking, anchor: TooltipAnchor) => void
  hide: () => void
}

export function useCalendarTooltip(): {
  state: CalendarTooltipState | null
  handlers: CalendarTooltipHandlers
} {
  const [state, setState] = useState<CalendarTooltipState | null>(null)
  const timer = useRef<number | null>(null)
  const open = useRef(false)

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const show = useCallback((booking: CalendarBooking, anchor: TooltipAnchor) => {
    clearTimer()
    if (open.current) {
      setState({ booking, anchor })
    } else {
      timer.current = window.setTimeout(() => {
        open.current = true
        setState({ booking, anchor })
      }, OPEN_DELAY)
    }
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    timer.current = window.setTimeout(() => {
      open.current = false
      setState(null)
    }, CLOSE_GRACE)
  }, [])

  useEffect(() => () => clearTimer(), [])

  const handlers = useMemo<CalendarTooltipHandlers>(() => ({ show, hide }), [show, hide])
  return { state, handlers }
}
