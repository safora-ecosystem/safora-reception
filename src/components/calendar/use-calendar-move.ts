import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
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
  contextMenu: (e: ReactMouseEvent) => void
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
  onReject?: () => void
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
  mode: "pending" | "pan" | "drag"
  pointerType: string
  downX: number
  downY: number
  lastX: number
  lastY: number
  holdTimer: number | null
  sourceEl: HTMLElement | null
}

const EDGE = 56
const MAX_SPEED = 22

const ARM_PX = 8

const HOLD_MS = 350
const TOUCH_SLOP_PX = 12

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
    const conflict = hasConflict(draft, config.bookings, s.booking.id)
    paintSelectionShape(
      ov,
      r.left,
      r.width,
      config.laneTops[s.laneIndex] + BAR_VPAD,
      config.rowHeight - 2 * BAR_VPAD,
      r.clippedStart,
      r.clippedEnd,
      conflict,
    )
    ov.style.backgroundColor = conflict ? "" : "var(--cal-booked-border)"
    ov.style.boxShadow = "var(--shadow-lg)"
    const fill = ov.firstElementChild as HTMLElement | null
    if (fill) fill.style.backgroundColor = conflict ? "" : "var(--cal-booked-surface)"
    const label = ov.querySelector<HTMLElement>("[data-ghost-label]")
    if (label) {
      label.textContent = s.booking.label
      label.style.color = conflict ? "var(--destructive-surface-foreground)" : "var(--cal-booked-foreground)"
    }
  }, [config])

  const apply = useCallback(() => {
    const s = stateRef.current
    const scroller = config.scrollRef.current
    if (!s || !scroller) return
    const rect = scroller.getBoundingClientRect()
    const { x, y } = pointerRef.current
    const minDay = Math.max(0, epochDay(config.today) - config.originDay)
    const rawCol =
      columnFromX(x, rect.left, scroller.scrollLeft, config.railWidth, config.dayWidth) - s.grabOffset
    const col =
      rawCol < minDay
        ? s.originCol < minDay
          ? s.originCol
          : minDay
        : Math.min(rawCol, Math.max(minDay, config.days - s.nights))
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

  const hide = useCallback(() => {
    const ov = config.overlayRef.current
    if (ov) ov.style.display = "none"
  }, [config])

  const settleRef = useRef<() => void>(() => {})
  const cancelRef = useRef<() => void>(() => {})

  const winHandlers = useRef({
    up: (ev: globalThis.PointerEvent) => {
      const s = stateRef.current
      if (s && ev.pointerId === s.pointerId) settleRef.current()
    },
    cancel: () => {
      if (stateRef.current) cancelRef.current()
    },
    key: (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && stateRef.current) cancelRef.current()
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
      const state: MoveState = {
        booking,
        nights: epochDay(booking.end) - epochDay(booking.start),
        grabOffset: pointerCol - startCol,
        startCol,
        laneIndex,
        originCol: startCol,
        originLaneIndex: laneIndex,
        pointerId: e.pointerId,
        dragged: false,
        mode: "pending",
        pointerType: e.pointerType,
        downX: e.clientX,
        downY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        holdTimer: null,
        sourceEl: e.currentTarget as HTMLElement,
      }
      stateRef.current = state
      if (e.pointerType === "touch") {
        state.holdTimer = window.setTimeout(() => {
          const st = stateRef.current
          if (st !== state || st.mode !== "pending") return
          st.holdTimer = null
          st.mode = "drag"
          st.dragged = true
          if (st.sourceEl) st.sourceEl.style.opacity = "0.35"
          paint()
        }, HOLD_MS)
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      attachWindow()
    },
    [config, attachWindow, paint],
  )

  const clearHold = useCallback(() => {
    const s = stateRef.current
    if (s?.holdTimer != null) {
      clearTimeout(s.holdTimer)
      s.holdTimer = null
    }
  }, [])

  const move = useCallback(
    (e: ReactPointerEvent) => {
      const s = stateRef.current
      if (!s) return
      pointerRef.current = { x: e.clientX, y: e.clientY }
      if (s.mode === "pending") {
        const dist = Math.hypot(e.clientX - s.downX, e.clientY - s.downY)
        if (s.pointerType === "touch") {
          if (dist >= TOUCH_SLOP_PX) {
            clearHold()
            s.mode = "pan"
          }
        } else if (dist >= ARM_PX) {
          s.mode = "drag"
          if (s.sourceEl) s.sourceEl.style.opacity = "0.35"
        }
      }
      if (s.mode === "pan") {
        const scroller = config.scrollRef.current
        if (scroller) {
          scroller.scrollLeft -= e.clientX - s.lastX
          scroller.scrollTop -= e.clientY - s.lastY
        }
      } else if (s.mode === "drag") {
        apply()
        syncAutoScroll()
      }
      s.lastX = e.clientX
      s.lastY = e.clientY
    },
    [apply, syncAutoScroll, config, clearHold],
  )

  const settle = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    clearHold()
    stateRef.current = null
    stopAutoScroll()
    hide()
    detachWindow()
    if (s.sourceEl) s.sourceEl.style.opacity = ""

    if (s.mode === "pan") {
      suppressClickRef.current = true
      return
    }
    if (!s.dragged) return
    suppressClickRef.current = true

    if (s.startCol === s.originCol && s.laneIndex === s.originLaneIndex) return
    const draft = draftOf(s, config.originDay, config.lanes)
    if (hasConflict(draft, config.bookings, s.booking.id)) {
      config.onReject?.()
      return
    }
    config.onCommit(s.booking.id, draft)
  }, [config, hide, stopAutoScroll, detachWindow, clearHold])
  settleRef.current = settle

  const finish = useCallback(
    (e: ReactPointerEvent) => {
      const s = stateRef.current
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
    const s = stateRef.current
    clearHold()
    stateRef.current = null
    stopAutoScroll()
    hide()
    detachWindow()
    if (s?.sourceEl) s.sourceEl.style.opacity = ""
    if (s?.dragged || s?.mode === "pan") suppressClickRef.current = true
  }, [hide, stopAutoScroll, detachWindow, clearHold])
  cancelRef.current = cancel

  const contextMenu = useCallback((e: ReactMouseEvent) => {
    if (stateRef.current?.pointerType === "touch") e.preventDefault()
  }, [])

  useEffect(() => detachWindow, [detachWindow])
  useEffect(() => stopAutoScroll, [stopAutoScroll])

  const consumeClick = useCallback(() => {
    const v = suppressClickRef.current
    suppressClickRef.current = false
    return v
  }, [])

  return useMemo(
    () => ({ start, move, finish, cancel, consumeClick, contextMenu }),
    [start, move, finish, cancel, consumeClick, contextMenu],
  )
}
