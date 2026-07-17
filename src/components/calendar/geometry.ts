import type { CalendarBooking, CalendarRoom, CalendarStatus } from "./types"


const DAY_MS = 86_400_000

const OCCUPYING: CalendarStatus[] = ["booked", "checked_in"]

export function epochDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function isoFromEpochDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  return isoFromEpochDay(epochDay(iso) + n)
}

export function nightsBetween(start: string, end: string): number {
  return epochDay(end) - epochDay(start)
}

export function dateForColumn(originDay: number, col: number): Date {
  return new Date((originDay + col) * DAY_MS)
}

export function isWeekendColumn(originDay: number, col: number): boolean {
  const dow = new Date((originDay + col) * DAY_MS).getUTCDay()
  return dow === 0 || dow === 6
}

export function isSundayColumn(originDay: number, col: number): boolean {
  return new Date((originDay + col) * DAY_MS).getUTCDay() === 0
}

export function todayColumn(originDay: number, days: number, today: string): number {
  const col = epochDay(today) - originDay
  return col >= 0 && col < days ? col : -1
}


export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return epochDay(aStart) < epochDay(bEnd) && epochDay(aEnd) > epochDay(bStart)
}

export function hasConflict(
  draft: { roomId: string; start: string; end: string },
  bookings: CalendarBooking[],
  ignoreId?: string,
): boolean {
  return bookings.some(
    (b) =>
      b.roomId === draft.roomId &&
      b.id !== ignoreId &&
      OCCUPYING.includes(b.status) &&
      overlaps(draft.start, draft.end, b.start, b.end),
  )
}


export interface BarRect {
  left: number
  width: number
  clippedStart: boolean
  clippedEnd: boolean
  cull: boolean
}

const MIN_BAR_PX = 4

export const BAR_VPAD = 5

export function barRect(
  start: string,
  end: string,
  originDay: number,
  dayWidth: number,
  bodyWidth: number,
): BarRect {
  const startIdx = epochDay(start) - originDay
  const endIdx = epochDay(end) - originDay
  const leftRaw = (startIdx + 0.5) * dayWidth
  const rightRaw = (endIdx + 0.5) * dayWidth

  const cull = rightRaw <= 0 || leftRaw >= bodyWidth
  const left = Math.max(leftRaw, 0)
  const right = Math.min(rightRaw, bodyWidth)

  return {
    left: Math.round(left),
    width: cull ? 0 : Math.max(Math.round(right - left), MIN_BAR_PX),
    clippedStart: leftRaw < 0,
    clippedEnd: rightRaw > bodyWidth,
    cull,
  }
}

export function columnFromX(
  clientX: number,
  scrollerLeft: number,
  scrollLeft: number,
  railWidth: number,
  dayWidth: number,
): number {
  return Math.floor((clientX - scrollerLeft + scrollLeft - railWidth) / dayWidth)
}


export type Lane =
  | { kind: "group"; id: string; group: string; count: number; collapsed: boolean }
  | { kind: "room"; id: string; room: CalendarRoom }

function roomOrder(r: CalendarRoom): number {
  if (r.order != null) return r.order
  const n = Number.parseInt(r.label, 10)
  return Number.isNaN(n) ? 0 : n
}

function compareRooms(a: CalendarRoom, b: CalendarRoom): number {
  return roomOrder(a) - roomOrder(b) || a.label.localeCompare(b.label)
}

export function buildLanes(
  rooms: CalendarRoom[],
  groupByFloor: boolean,
  collapsed: ReadonlySet<string>,
): Lane[] {
  const sorted = [...rooms].sort(compareRooms)
  if (!groupByFloor) {
    return sorted.map((room) => ({ kind: "room", id: room.id, room }))
  }

  const groups = new Map<string, CalendarRoom[]>()
  for (const room of sorted) {
    const key = room.group ?? ""
    const arr = groups.get(key)
    if (arr) arr.push(room)
    else groups.set(key, [room])
  }

  const lanes: Lane[] = []
  for (const [key, groupRooms] of groups) {
    if (key === "") {
      for (const room of groupRooms) lanes.push({ kind: "room", id: room.id, room })
      continue
    }
    const isCollapsed = collapsed.has(key)
    lanes.push({ kind: "group", id: `group:${key}`, group: key, count: groupRooms.length, collapsed: isCollapsed })
    if (!isCollapsed) {
      for (const room of groupRooms) lanes.push({ kind: "room", id: room.id, room })
    }
  }
  return lanes
}

// ── Header oy segmentlari ─────────────────────────────────────────────────────

export interface MonthSegment {
  month: number
  year: number
  startCol: number
  span: number
}

/** Ketma-ket bir oyga tegishli ustunlarni bitta segmentga birlashtiradi (oy tasmasi uchun). */
export function monthSegments(originDay: number, days: number): MonthSegment[] {
  const segs: MonthSegment[] = []
  for (let col = 0; col < days; col++) {
    const d = new Date((originDay + col) * DAY_MS)
    const month = d.getUTCMonth()
    const year = d.getUTCFullYear()
    const last = segs[segs.length - 1]
    if (last && last.month === month && last.year === year) last.span++
    else segs.push({ month, year, startCol: col, span: 1 })
  }
  return segs
}

// ── Pozitsiyalangan bar (use-lanes.ts memoizatsiya qiladi) ────────────────────

export interface PositionedBar {
  booking: CalendarBooking
  rect: BarRect
}
