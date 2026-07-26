import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import {
  BAR_VPAD,
  barRect,
  columnFromX,
  epochDay,
  hasConflict,
  isoFromEpochDay,
  paintSelectionShape,
  roomLaneAtY,
  type Lane,
} from "./geometry"
import type { CalendarBooking, CalendarDraft } from "./types"


export interface CalendarMoveHandlers {
  start: (e: ReactPointerEvent, booking: CalendarBooking) => void
  move: (e: ReactPointerEvent) => void
  finish: (e: ReactPointerEvent) => void
  cancel: () => void
  consumeClick: () => boolean
}

interface MoveConfig {
  scrollRef: RefObject<HTMLDivElement | null>
  overlayRef: RefObject<HTMLDivElement | null>
  originDay: number
  days: number
  dayWidth: number
  rowHeight: number
  railWidth: number
  headerHeight: number
  groupHeight: number
  today: string
  lanes: Lane[]
  laneTops: number[]
  bookings: CalendarBooking[]
  checkInFrac: number
  checkOutFrac: number
  onCommit: (id: string, next: CalendarDraft) => void
}

interface MoveState {
  booking: CalendarBooking
  nights: number
  grabOffset: number
  startCol: number
  laneIndex: number
  originCol: number
  originLaneIndex: number
  pointerId: number
  dragged: boolean
}

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

const EDGE = 56
const MAX_SPEED = 22

function draftOf(s: MoveState, originDay: number, lanes: Lane[]): CalendarDraft {
  const lane = lanes[s.laneIndex]
  return {
    roomId: lane?.kind === "room" ? lane.room.id : s.booking.roomId,
    start: isoFromEpochDay(originDay + s.startCol),
    end: isoFromEpochDay(originDay + s.startCol + s.nights),
  }
}

export function useCalendarMove(config: MoveConfig): CalendarMoveHandlers {
  const stateRef = useRef<MoveState | null>(null)
  const suppressClickRef = useRef(false)
  const pointerRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)

  const paint = useCallback(() => {
    const s = stateRef.current
    const ov = config.overlayRef.current
    if (!s || !ov) return
    const draft = draftOf(s, config.originDay, config.lanes)
    const bodyWidth = config.days * config.dayWidth
    const r = barRect(draft.start, draft.end, config.originDay, config.dayWidth, bodyWidth, config.checkInFrac, config.checkOutFrac)
    paintSelectionShape(
      ov,
      r.left,
      r.width,
      config.laneTops[s.laneIndex] + BAR_VPAD,
      config.rowHeight - 2 * BAR_VPAD,
      r.clippedStart,
      r.clippedEnd,
      hasConflict(draft, config.bookings, s.booking.id),
    )
  }, [config])

  const apply = useCallback(() => {
    const s = stateRef.current
    const scroller = config.scrollRef.current
    if (!s || !scroller) return
    const rect = scroller.getBoundingClientRect()
    const { x, y } = pointerRef.current
    const minDay = Math.max(0, epochDay(config.today) - config.originDay)
    const col = clamp(
      columnFromX(x, rect.left, scroller.scrollLeft, config.railWidth, config.dayWidth) - s.grabOffset,
      minDay,
      Math.max(minDay, config.days - s.nights),
    )
    const yLocal = y - rect.top + scroller.scrollTop - config.headerHeight
    const lane = roomLaneAtY(yLocal, config.lanes, config.laneTops, config.rowHeight, config.groupHeight)
    const nextLane = lane >= 0 ? lane : s.laneIndex
    if (col === s.startCol && nextLane === s.laneIndex) return
    s.startCol = col
    s.laneIndex = nextLane
    s.dragged = true
    paint()
  }, [config, paint])

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    const s = stateRef.current
    const scroller = config.scrollRef.current
    if (!s || !scroller) {
      rafRef.current = null
      return
    }
    const rect = scroller.getBoundingClientRect()
    const { x, y } = pointerRef.current
    const leftEdge = rect.left + config.railWidth
    const topEdge = rect.top + config.headerHeight
    const ramp = (depth: number) => Math.ceil((Math.min(depth, EDGE) / EDGE) * MAX_SPEED)
    let dx = 0
    let dy = 0
    if (x < leftEdge + EDGE) dx = -ramp(leftEdge + EDGE - x)
    else if (x > rect.right - EDGE) dx = ramp(x - (rect.right - EDGE))
    if (y < topEdge + EDGE) dy = -ramp(topEdge + EDGE - y)
    else if (y > rect.bottom - EDGE) dy = ramp(y - (rect.bottom - EDGE))
    if (dx === 0 && dy === 0) {
      rafRef.current = null
      return
    }
    scroller.scrollLeft += dx
    scroller.scrollTop += dy
    apply()
    rafRef.current = requestAnimationFrame(tick)
  }, [config, apply])

  const syncAutoScroll = useCallback(() => {
    const scroller = config.scrollRef.current
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    const { x, y } = pointerRef.current
    const near =
      x < rect.left + config.railWidth + EDGE ||
      x > rect.right - EDGE ||
      y < rect.top + config.headerHeight + EDGE ||
      y > rect.bottom - EDGE
    if (near) {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
    } else {
      stopAutoScroll()
    }
  }, [config, tick, stopAutoScroll])

  const start = useCallback(
    (e: ReactPointerEvent, booking: CalendarBooking) => {
      suppressClickRef.current = false
      if (e.button !== 0 || booking.status !== "booked") return
      const scroller = config.scrollRef.current
      if (!scroller) return
      const rect = scroller.getBoundingClientRect()
      const startCol = epochDay(booking.start) - config.originDay
      const pointerCol = columnFromX(e.clientX, rect.left, scroller.scrollLeft, config.railWidth, config.dayWidth)
      const y = e.clientY - rect.top + scroller.scrollTop - config.headerHeight
      const laneIndex = roomLaneAtY(y, config.lanes, config.laneTops, config.rowHeight, config.groupHeight)
      if (laneIndex < 0) return

      pointerRef.current = { x: e.clientX, y: e.clientY }
      stateRef.current = {
        booking,
        nights: epochDay(booking.end) - epochDay(booking.start),
        grabOffset: pointerCol - startCol,
        startCol,
        laneIndex,
        originCol: startCol,
        originLaneIndex: laneIndex,
        pointerId: e.pointerId,
        dragged: false,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [config],
  )

  const move = useCallback(
    (e: ReactPointerEvent) => {
      if (!stateRef.current) return
      pointerRef.current = { x: e.clientX, y: e.clientY }
      apply()
      syncAutoScroll()
    },
    [apply, syncAutoScroll],
  )

  const hide = useCallback(() => {
    const ov = config.overlayRef.current
    if (ov) ov.style.display = "none"
  }, [config])

  const finish = useCallback(
    (e: ReactPointerEvent) => {
      const s = stateRef.current
      if (!s) return
      stateRef.current = null
      stopAutoScroll()
      hide()
      try {
        e.currentTarget.releasePointerCapture(s.pointerId)
      } catch {
      }

      if (!s.dragged) return
      suppressClickRef.current = true

      if (s.startCol === s.originCol && s.laneIndex === s.originLaneIndex) return
      const draft = draftOf(s, config.originDay, config.lanes)
      if (hasConflict(draft, config.bookings, s.booking.id)) return
      config.onCommit(s.booking.id, draft)
    },
    [config, hide, stopAutoScroll],
  )

  const cancel = useCallback(() => {
    stateRef.current = null
    stopAutoScroll()
    hide()
  }, [hide, stopAutoScroll])

  const consumeClick = useCallback(() => {
    const v = suppressClickRef.current
    suppressClickRef.current = false
    return v
  }, [])

  return useMemo(
    () => ({ start, move, finish, cancel, consumeClick }),
    [start, move, finish, cancel, consumeClick],
  )
}
