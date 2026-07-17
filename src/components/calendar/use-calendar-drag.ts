import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import { BAR_VPAD, columnFromX, hasConflict, isoFromEpochDay } from "./geometry"
import type { CalendarBooking, CalendarDraft } from "./types"


interface DragConfig {
  scrollRef: RefObject<HTMLDivElement | null>
  overlayRef: RefObject<HTMLDivElement | null>
  originDay: number
  days: number
  dayWidth: number
  rowHeight: number
  railWidth: number
  bookings: CalendarBooking[]
  onCommit: (draft: CalendarDraft) => void
}

interface DragState {
  roomId: string
  rowTop: number
  startDay: number
  curDay: number
  scrollerLeft: number
  scrollLeft: number
  pointerId: number
}

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

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

  const paint = useCallback(() => {
    const s = dragRef.current
    const ov = config.overlayRef.current
    if (!s || !ov) return
    const min = Math.min(s.startDay, s.curDay)
    const max = Math.max(s.startDay, s.curDay)
    const conflict = hasConflict(draftFromState(s, config.originDay), config.bookings)
    ov.style.display = "block"
    ov.style.left = `${min * config.dayWidth}px`
    ov.style.width = `${(max - min + 1) * config.dayWidth}px`
    ov.style.top = `${s.rowTop + BAR_VPAD}px`
    ov.style.height = `${config.rowHeight - 2 * BAR_VPAD}px`
    ov.dataset.conflict = conflict ? "true" : "false"
  }, [config])

  const start = useCallback(
    (e: ReactPointerEvent, roomId: string, rowTop: number) => {
      if (e.button !== 0) return
      const scroller = config.scrollRef.current
      if (!scroller) return
      const rect = scroller.getBoundingClientRect()
      const scrollLeft = scroller.scrollLeft
      const day = clamp(
        columnFromX(e.clientX, rect.left, scrollLeft, config.railWidth, config.dayWidth),
        0,
        config.days - 1,
      )
      dragRef.current = {
        roomId,
        rowTop,
        startDay: day,
        curDay: day,
        scrollerLeft: rect.left,
        scrollLeft,
        pointerId: e.pointerId,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      paint()
    },
    [config, paint],
  )

  const move = useCallback(
    (e: ReactPointerEvent) => {
      const s = dragRef.current
      if (!s) return
      const day = clamp(
        columnFromX(e.clientX, s.scrollerLeft, s.scrollLeft, config.railWidth, config.dayWidth),
        0,
        config.days - 1,
      )
      if (day !== s.curDay) {
        s.curDay = day
        paint()
      }
    },
    [config, paint],
  )

  const finish = useCallback(
    (e: ReactPointerEvent) => {
      const s = dragRef.current
      if (!s) return
      dragRef.current = null
      const ov = config.overlayRef.current
      if (ov) ov.style.display = "none"
      try {
        e.currentTarget.releasePointerCapture(s.pointerId)
      } catch {
        /* capture allaqachon yo'qolgan bo'lishi mumkin */
      }
      const draft = draftFromState(s, config.originDay)
      if (hasConflict(draft, config.bookings)) return // band — yaratmaymiz
      config.onCommit(draft)
    },
    [config],
  )

  const cancel = useCallback(() => {
    dragRef.current = null
    const ov = config.overlayRef.current
    if (ov) ov.style.display = "none"
  }, [config])

  return { start, move, finish, cancel }
}
