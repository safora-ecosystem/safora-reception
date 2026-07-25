import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import {
  BAR_VPAD,
  barRect,
  columnFromX,
  epochDay,
  freeSpanAround,
  hasConflict,
  isoFromEpochDay,
  paintSelectionShape,
} from "./geometry"
import type { CalendarBooking, CalendarDraft } from "./types"


interface DragConfig {
  scrollRef: RefObject<HTMLDivElement | null>
  overlayRef: RefObject<HTMLDivElement | null>
  originDay: number
  days: number
  dayWidth: number
  rowHeight: number
  railWidth: number
  today: string
  bookings: CalendarBooking[]
  onCommit: (draft: CalendarDraft) => void
}

interface DragState {
  roomId: string
  rowTop: number
  startDay: number
  curDay: number
  minCol: number
  maxCol: number
  pointerId: number
}

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

const EDGE = 56
const MAX_SPEED = 22

function draftFromState(s: DragState, originDay: number): CalendarDraft {
  const min = Math.min(s.startDay, s.curDay)
  const max = Math.max(s.startDay, s.curDay)
  return {
    roomId: s.roomId,
    start: isoFromEpochDay(originDay + min),
    end: isoFromEpochDay(originDay + max + 1),
  }
}

export function useCalendarDrag(config: DragConfig) {
  const dragRef = useRef<DragState | null>(null)
  const pointerXRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  const paint = useCallback(() => {
    const s = dragRef.current
    const ov = config.overlayRef.current
    if (!s || !ov) return
    const draft = draftFromState(s, config.originDay)
    const bodyWidth = config.days * config.dayWidth
    const r = barRect(draft.start, draft.end, config.originDay, config.dayWidth, bodyWidth)
    paintSelectionShape(
      ov,
      r.left,
      r.width,
      s.rowTop + BAR_VPAD,
      config.rowHeight - 2 * BAR_VPAD,
      r.clippedStart,
      r.clippedEnd,
      hasConflict(draft, config.bookings),
    )
  }, [config])

  const apply = useCallback(() => {
    const s = dragRef.current
    const scroller = config.scrollRef.current
    if (!s || !scroller) return
    const rect = scroller.getBoundingClientRect()
    const day = clamp(
      columnFromX(pointerXRef.current, rect.left, scroller.scrollLeft, config.railWidth, config.dayWidth),
      s.minCol,
      s.maxCol,
    )
    if (day !== s.curDay) {
      s.curDay = day
      paint()
    }
  }, [config, paint])

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    const s = dragRef.current
    const scroller = config.scrollRef.current
    if (!s || !scroller) {
      rafRef.current = null
      return
    }
    const rect = scroller.getBoundingClientRect()
    const x = pointerXRef.current
    const leftEdge = rect.left + config.railWidth
    const ramp = (depth: number) => Math.ceil((Math.min(depth, EDGE) / EDGE) * MAX_SPEED)
    let dx = 0
    if (x < leftEdge + EDGE) dx = -ramp(leftEdge + EDGE - x)
    else if (x > rect.right - EDGE) dx = ramp(x - (rect.right - EDGE))
    if (dx === 0) {
      rafRef.current = null
      return
    }
    scroller.scrollLeft += dx
    apply()
    rafRef.current = requestAnimationFrame(tick)
  }, [config, apply])

  const syncAutoScroll = useCallback(() => {
    const scroller = config.scrollRef.current
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    const x = pointerXRef.current
    const near = x < rect.left + config.railWidth + EDGE || x > rect.right - EDGE
    if (near) {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
    } else {
      stopAutoScroll()
    }
  }, [config, tick, stopAutoScroll])

  const start = useCallback(
    (e: ReactPointerEvent, roomId: string, rowTop: number) => {
      if (e.button !== 0) return
      const scroller = config.scrollRef.current
      if (!scroller) return
      const rect = scroller.getBoundingClientRect()
      const minDay = Math.max(0, epochDay(config.today) - config.originDay)
      if (minDay > config.days - 1) return
      const rawDay = columnFromX(e.clientX, rect.left, scroller.scrollLeft, config.railWidth, config.dayWidth)
      const day0 = clamp(rawDay, minDay, config.days - 1)
      const span = freeSpanAround(roomId, day0, config.bookings, config.originDay, minDay, config.days - 1)
      const day = clamp(day0, span.lo, span.hi)
      pointerXRef.current = e.clientX
      dragRef.current = {
        roomId,
        rowTop,
        startDay: day,
        curDay: day,
        minCol: span.lo,
        maxCol: span.hi,
        pointerId: e.pointerId,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      paint()
    },
    [config, paint],
  )

  const move = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragRef.current) return
      pointerXRef.current = e.clientX
      apply()
      syncAutoScroll()
    },
    [apply, syncAutoScroll],
  )

  const finish = useCallback(
    (e: ReactPointerEvent) => {
      const s = dragRef.current
      if (!s) return
      dragRef.current = null
      stopAutoScroll()
      const ov = config.overlayRef.current
      if (ov) ov.style.display = "none"
      try {
        e.currentTarget.releasePointerCapture(s.pointerId)
      } catch {
      }
      const draft = draftFromState(s, config.originDay)
      if (hasConflict(draft, config.bookings)) return
      config.onCommit(draft)
    },
    [config, stopAutoScroll],
  )

  const cancel = useCallback(() => {
    dragRef.current = null
    stopAutoScroll()
    const ov = config.overlayRef.current
    if (ov) ov.style.display = "none"
  }, [config, stopAutoScroll])

  return { start, move, finish, cancel }
}
