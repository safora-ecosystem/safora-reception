import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import { BAR_VPAD, columnFromX, epochDay, hasConflict, isoFromEpochDay, roomLaneAtY, type Lane } from "./geometry"
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
  lanes: Lane[]
  laneTops: number[]
  bookings: CalendarBooking[]
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
  scrollerLeft: number
  scrollerTop: number
  scrollLeft: number
  scrollTop: number
  pointerId: number
  dragged: boolean
}

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

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

  const paint = useCallback(() => {
    const s = stateRef.current
    const ov = config.overlayRef.current
    if (!s || !ov) return
    const draft = draftOf(s, config.originDay, config.lanes)
    ov.style.display = "block"
    ov.style.left = `${(s.startCol + 0.5) * config.dayWidth}px`
    ov.style.width = `${s.nights * config.dayWidth}px`
    ov.style.top = `${config.laneTops[s.laneIndex] + BAR_VPAD}px`
    ov.style.height = `${config.rowHeight - 2 * BAR_VPAD}px`
    ov.dataset.conflict = hasConflict(draft, config.bookings, s.booking.id) ? "true" : "false"
  }, [config])

  const start = useCallback(
    (e: ReactPointerEvent, booking: CalendarBooking) => {
      // Har yangi jest bayroqni tozalaydi. Sudrash tugagach `click` KELMASLIGI mumkin (bar
      // virtualizatsiya yoki auto-refresh tufayli DOM'dan chiqib ketsa) — o'shanda bayroq
      // `true` bo'lib qolib, keyingi haqiqiy klikni yutib yuborardi.
      suppressClickRef.current = false
      // Ko'chirish faqat kelmagan mehmon uchun — server ham aynan shuni majburlaydi (409).
      if (e.button !== 0 || booking.status !== "booked") return
      const scroller = config.scrollRef.current
      if (!scroller) return
      const rect = scroller.getBoundingClientRect()
      const scrollLeft = scroller.scrollLeft
      const scrollTop = scroller.scrollTop
      const startCol = epochDay(booking.start) - config.originDay
      const pointerCol = columnFromX(e.clientX, rect.left, scrollLeft, config.railWidth, config.dayWidth)
      const y = e.clientY - rect.top + scrollTop - config.headerHeight
      const laneIndex = roomLaneAtY(y, config.lanes, config.laneTops, config.rowHeight, config.groupHeight)
      if (laneIndex < 0) return

      stateRef.current = {
        booking,
        nights: epochDay(booking.end) - epochDay(booking.start),
        grabOffset: pointerCol - startCol,
        startCol,
        laneIndex,
        originCol: startCol,
        originLaneIndex: laneIndex,
        scrollerLeft: rect.left,
        scrollerTop: rect.top,
        scrollLeft,
        scrollTop,
        pointerId: e.pointerId,
        dragged: false,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      // Ataylab paint YO'Q: oddiy klikda ghost miltillamasin.
    },
    [config],
  )

  const move = useCallback(
    (e: ReactPointerEvent) => {
      const s = stateRef.current
      if (!s) return
      const col = clamp(
        columnFromX(e.clientX, s.scrollerLeft, s.scrollLeft, config.railWidth, config.dayWidth) - s.grabOffset,
        0,
        Math.max(0, config.days - s.nights),
      )
      const y = e.clientY - s.scrollerTop + s.scrollTop - config.headerHeight
      const lane = roomLaneAtY(y, config.lanes, config.laneTops, config.rowHeight, config.groupHeight)
      const nextLane = lane >= 0 ? lane : s.laneIndex // guruh sarlavhasi ustida — oxirgi xonada qolamiz

      if (col === s.startCol && nextLane === s.laneIndex) return
      s.startCol = col
      s.laneIndex = nextLane
      s.dragged = true
      paint()
    },
    [config, paint],
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
      hide()
      try {
        e.currentTarget.releasePointerCapture(s.pointerId)
      } catch {
        /* capture allaqachon yo'qolgan bo'lishi mumkin */
      }

      if (!s.dragged) return // qimirlamadi — bu klik, selection o'z yo'lida ketsin
      suppressClickRef.current = true

      if (s.startCol === s.originCol && s.laneIndex === s.originLaneIndex) return // joyiga qaytdi
      const draft = draftOf(s, config.originDay, config.lanes)
      if (hasConflict(draft, config.bookings, s.booking.id)) return // band — jim rad etamiz (ghost qizil edi)
      config.onCommit(s.booking.id, draft)
    },
    [config, hide],
  )

  const cancel = useCallback(() => {
    stateRef.current = null
    hide()
  }, [hide])

  const consumeClick = useCallback(() => {
    const v = suppressClickRef.current
    suppressClickRef.current = false
    return v
  }, [])

  // Barqaror obyekt — `CalendarBar` React.memo'si buzilmasin (perf shartnomasi #4).
  return useMemo(
    () => ({ start, move, finish, cancel, consumeClick }),
    [start, move, finish, cancel, consumeClick],
  )
}
