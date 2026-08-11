import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import {
  BAR_VPAD,
  barRectFromDays,
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
  minStart: string | null
  bookings: CalendarBooking[]
  checkInFrac: number
  checkOutFrac: number
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

const floorColumn = (minStart: string | null, originDay: number) =>
  minStart ? Math.max(0, epochDay(minStart) - originDay) : 0

const EDGE = 56
const MAX_SPEED = 22

const DRAG_OPACITY = "1"
const HOVER_OPACITY = "0.4"

function clearMoveSkin(ov: HTMLElement) {
  ov.style.backgroundColor = ""
  ov.style.boxShadow = ""
  const fill = ov.firstElementChild as HTMLElement | null
  if (fill) fill.style.backgroundColor = ""
  const label = ov.querySelector<HTMLElement>("[data-ghost-label]")
  if (label) {
    label.textContent = ""
    label.style.color = ""
  }
}

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
  const hoverRef = useRef<{ roomId: string; day: number } | null>(null)

  const paint = useCallback(() => {
    const s = dragRef.current
    const ov = config.overlayRef.current
    if (!s || !ov) return
    clearMoveSkin(ov)
    const draft = draftFromState(s, config.originDay)
    const bodyWidth = config.days * config.dayWidth
    const r = barRectFromDays(
      Math.min(s.startDay, s.curDay),
      Math.max(s.startDay, s.curDay) + 1,
      config.dayWidth,
      bodyWidth,
      config.checkInFrac,
      config.checkOutFrac,
    )
    ov.style.opacity = DRAG_OPACITY
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

  const paintHover = useCallback(
    (e: ReactPointerEvent, roomId: string, rowTop: number) => {
      const scroller = config.scrollRef.current
      const ov = config.overlayRef.current
      if (!scroller || !ov) return
      const rect = scroller.getBoundingClientRect()
      const day = columnFromX(e.clientX, rect.left, scroller.scrollLeft, config.railWidth, config.dayWidth)
      const prev = hoverRef.current
      if (prev && prev.roomId === roomId && prev.day === day) return
      hoverRef.current = { roomId, day }
      const minDay = floorColumn(config.minStart, config.originDay)
      const draft = {
        roomId,
        start: isoFromEpochDay(config.originDay + day),
        end: isoFromEpochDay(config.originDay + day + 1),
      }
      const target = e.currentTarget as HTMLElement
      if (day < minDay || day > config.days - 1 || hasConflict(draft, config.bookings)) {
        ov.style.display = "none"
        target.style.cursor = "not-allowed"
        return
      }
      target.style.cursor = ""
      clearMoveSkin(ov)
      const bodyWidth = config.days * config.dayWidth
      const r = barRectFromDays(day, day + 1, config.dayWidth, bodyWidth, config.checkInFrac, config.checkOutFrac)
      ov.style.opacity = HOVER_OPACITY
      paintSelectionShape(
        ov,
        r.left,
        r.width,
        rowTop + BAR_VPAD,
        config.rowHeight - 2 * BAR_VPAD,
        r.clippedStart,
        r.clippedEnd,
        false,
      )
    },
    [config],
  )

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

  const settleRef = useRef<() => void>(() => {})
  const cancelRef = useRef<() => void>(() => {})

  const winHandlers = useRef({
    up: (ev: globalThis.PointerEvent) => {
      const s = dragRef.current
      if (s && ev.pointerId === s.pointerId) settleRef.current()
    },
    cancel: () => {
      if (dragRef.current) cancelRef.current()
    },
    key: (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && dragRef.current) cancelRef.current()
    },
  })
  const attachWindow = useCallback(() => {
    const h = winHandlers.current
    window.addEventListener("pointerup", h.up)
    window.addEventListener("pointercancel", h.cancel)
    window.addEventListener("keydown", h.key, true)
  }, [])
  const detachWindow = useCallback(() => {
    const h = winHandlers.current
    window.removeEventListener("pointerup", h.up)
    window.removeEventListener("pointercancel", h.cancel)
    window.removeEventListener("keydown", h.key, true)
  }, [])

  const start = useCallback(
    (e: ReactPointerEvent, roomId: string, rowTop: number) => {
      if (e.button !== 0) return
      const scroller = config.scrollRef.current
      if (!scroller) return
      const rect = scroller.getBoundingClientRect()
      const minDay = floorColumn(config.minStart, config.originDay)
      if (minDay > config.days - 1) return
      const rawDay = columnFromX(e.clientX, rect.left, scroller.scrollLeft, config.railWidth, config.dayWidth)
      const day0 = clamp(rawDay, minDay, config.days - 1)
      const span = freeSpanAround(roomId, day0, config.bookings, config.originDay, minDay, config.days - 1)
      const day = clamp(day0, span.lo, span.hi)
      pointerXRef.current = e.clientX
      hoverRef.current = null
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
      attachWindow()
      paint()
    },
    [config, paint, attachWindow],
  )

  const move = useCallback(
    (e: ReactPointerEvent, roomId: string, rowTop: number) => {
      if (dragRef.current) {
        pointerXRef.current = e.clientX
        apply()
        syncAutoScroll()
        return
      }
      paintHover(e, roomId, rowTop)
    },
    [apply, syncAutoScroll, paintHover],
  )

  const settle = useCallback(() => {
    const s = dragRef.current
    if (!s) return
    dragRef.current = null
    stopAutoScroll()
    detachWindow()
    const ov = config.overlayRef.current
    if (ov) ov.style.display = "none"
    const draft = draftFromState(s, config.originDay)
    if (hasConflict(draft, config.bookings)) return
    config.onCommit(draft)
  }, [config, stopAutoScroll, detachWindow])
  settleRef.current = settle

  const finish = useCallback(
    (e: ReactPointerEvent) => {
      const s = dragRef.current
      if (!s) return
      try {
        e.currentTarget.releasePointerCapture(s.pointerId)
      } catch {
      }
      settle()
    },
    [settle],
  )

  const cancel = useCallback(() => {
    dragRef.current = null
    stopAutoScroll()
    detachWindow()
    const ov = config.overlayRef.current
    if (ov) ov.style.display = "none"
  }, [config, stopAutoScroll, detachWindow])
  cancelRef.current = cancel

  useEffect(() => detachWindow, [detachWindow])
  useEffect(() => stopAutoScroll, [stopAutoScroll])

  const hoverEnd = useCallback(() => {
    if (dragRef.current) return
    hoverRef.current = null
    const ov = config.overlayRef.current
    if (ov) ov.style.display = "none"
  }, [config])

  return { start, move, finish, cancel, hoverEnd }
}
