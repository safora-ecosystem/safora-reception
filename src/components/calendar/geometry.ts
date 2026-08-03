import type { CalendarBooking, CalendarRoom, CalendarStatus } from "./types"


const DAY_MS = 86_400_000

const OCCUPYING: CalendarStatus[] = ["booked", "checked_in", "blocked"]

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

export function dayFraction(time: string | undefined): number {
  if (!time) return 0
  const [h, m] = time.slice(0, 5).split(":").map(Number)
  const mins = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
  return Math.min(1, Math.max(0, mins / 1440))
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


const CULL_MIN_OVERSCAN = 7

export interface ColumnWindow {
  lo: number
  hi: number
}

export function columnWindow(
  scrollLeft: number,
  clientWidth: number,
  dayWidth: number,
  days: number,
): ColumnWindow {
  if (dayWidth <= 0 || clientWidth <= 0) return { lo: 0, hi: days }
  const viewCols = Math.ceil(clientWidth / dayWidth)
  const overscan = Math.max(CULL_MIN_OVERSCAN, viewCols)
  const step = Math.max(CULL_MIN_OVERSCAN, overscan >> 1)
  const first = Math.floor(scrollLeft / dayWidth)
  return {
    lo: Math.max(0, Math.floor((first - overscan) / step) * step),
    hi: Math.min(days, Math.ceil((first + viewCols + overscan) / step) * step),
  }
}

export function sameColumnWindow(a: ColumnWindow, b: ColumnWindow): boolean {
  return a.lo === b.lo && a.hi === b.hi
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

export function busyRoomsIn(
  bookings: CalendarBooking[],
  start: string,
  end: string,
): Set<string> {
  const out = new Set<string>()
  if (epochDay(end) <= epochDay(start)) return out
  for (const b of bookings) {
    if (!OCCUPYING.includes(b.status)) continue
    if (overlaps(start, end, b.start, b.end)) out.add(b.roomId)
  }
  return out
}

export function freeSpanAround(
  roomId: string,
  startCol: number,
  bookings: CalendarBooking[],
  originDay: number,
  minCol: number,
  maxCol: number,
): { lo: number; hi: number } {
  let lo = minCol
  let hi = maxCol
  for (const b of bookings) {
    if (b.roomId !== roomId || !OCCUPYING.includes(b.status)) continue
    const bs = epochDay(b.start) - originDay
    const be = epochDay(b.end) - originDay
    if (be <= startCol) {
      if (be > lo) lo = be
    } else if (bs > startCol) {
      if (bs - 1 < hi) hi = bs - 1
    }
  }
  return { lo, hi }
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

function rectFromIdx(
  startIdx: number,
  endIdx: number,
  dayWidth: number,
  bodyWidth: number,
  checkInFrac: number,
  checkOutFrac: number,
): BarRect {
  const leftRaw = (startIdx + checkInFrac) * dayWidth
  const rightRaw = (endIdx + checkOutFrac) * dayWidth
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

export function barRect(
  start: string,
  end: string,
  originDay: number,
  dayWidth: number,
  bodyWidth: number,
  checkInFrac = 0,
  checkOutFrac = 0,
): BarRect {
  return rectFromIdx(
    epochDay(start) - originDay,
    epochDay(end) - originDay,
    dayWidth,
    bodyWidth,
    checkInFrac,
    checkOutFrac,
  )
}

export function barRectFromDays(
  startIdx: number,
  endIdx: number,
  dayWidth: number,
  bodyWidth: number,
  checkInFrac = 0,
  checkOutFrac = 0,
): BarRect {
  return rectFromIdx(startIdx, endIdx, dayWidth, bodyWidth, checkInFrac, checkOutFrac)
}


export const BAR_RADIUS = 8

export function barCornerRadius(radius: number, clippedStart: boolean, clippedEnd: boolean): string {
  const s = clippedStart ? 0 : Math.max(radius, 0)
  const e = clippedEnd ? 0 : Math.max(radius, 0)
  return `${s}px ${e}px ${e}px ${s}px`
}

/**
 * Drag/ghost overlay'ni AYNAN CalendarBar shakliga soladi — ref bilan imperativ (render'dan
 * tashqari, 60fps). Ikki qatlam: element o'zi = kontur, birinchi bolasi = fill; ranglar CSS
 * class'da, bu yerda faqat geometriya + shakl. `conflict` → `data-conflict` (rang CSS'da
 * almashadi). Yaratish ham, ko'chirish ham SHU bilan bo'yaydi — shakl bir manbadan keladi.
 */
export function paintSelectionShape(
  el: HTMLElement,
  left: number,
  width: number,
  top: number,
  height: number,
  clippedStart: boolean,
  clippedEnd: boolean,
  conflict: boolean,
): void {
  el.style.display = "block"
  el.style.left = `${left}px`
  el.style.width = `${width}px`
  el.style.top = `${top}px`
  el.style.height = `${height}px`
  el.style.borderRadius = barCornerRadius(BAR_RADIUS, clippedStart, clippedEnd)
  const fill = el.firstElementChild
  if (fill instanceof HTMLElement) {
    // Ichki radius konsentrik: tashqi radius − kontur qalinligi (overlay'da `p-[2px]`).
    fill.style.borderRadius = barCornerRadius(BAR_RADIUS - 2, clippedStart, clippedEnd)
  }
  el.dataset.conflict = conflict ? "true" : "false"
}

/** Drag paytida clientX → ustun indeksi (clamp qilinmagan; chaqiruvchi clamp qiladi). */
export function columnFromX(
  clientX: number,
  scrollerLeft: number,
  scrollLeft: number,
  railWidth: number,
  dayWidth: number,
): number {
  return Math.floor((clientX - scrollerLeft + scrollLeft - railWidth) / dayWidth)
}

// ── Lane modeli (guruh sarlavhasi + xona satrlari) ────────────────────────────

export type Lane =
  | { kind: "group"; id: string; group: string; count: number; collapsed: boolean }
  | { kind: "room"; id: string; room: CalendarRoom }

function roomOrder(r: CalendarRoom): number {
  if (r.order != null) return r.order
  const n = Number.parseInt(r.label, 10)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Xona tartibi — REYD va yaratish formasidagi tanlagich UCHUN BITTA qoida. Saralash xona
 * RAQAMI bo'yicha (qavat raqam ichida kodlangan), guruh nomi bo'yicha EMAS: matn saralashda
 * "10-qavat" "2-qavat" dan oldin kelib, ikki ro'yxat boshqa-boshqa tartibda ko'rinardi.
 */
export function compareRooms(a: CalendarRoom, b: CalendarRoom): number {
  return roomOrder(a) - roomOrder(b) || a.label.localeCompare(b.label)
}

/**
 * Xonalarni tekis lane ro'yxatiga aylantiradi. groupByFloor bo'lsa har guruh oldiga
 * sarlavha lane qo'yiladi va collapsed guruhlarning xonalari tushirib qoldiriladi.
 * Guruh tartibi = saralangan xonalarda birinchi uchrash tartibi (xona raqami qavatni kodlaydi).
 */
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
    // Guruhsiz xonalar (key === "") sarlavhasiz to'g'ridan-to'g'ri chiqadi.
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

/**
 * Lane tepalari (body-lokal piksel). Formula virtualizer'ning `estimateSize`i bilan AYNAN bir xil
 * bo'lishi shart — `measureElement` ataylab o'chirilgan (perf shartnomasi #3), shuning uchun
 * o'lchov statik va bu yerda takrorlanishi xavfsiz.
 */
export function laneOffsets(lanes: Lane[], rowHeight: number, groupHeight: number): number[] {
  const tops = new Array<number>(lanes.length)
  let y = 0
  for (let i = 0; i < lanes.length; i++) {
    tops[i] = y
    y += lanes[i].kind === "group" ? groupHeight : rowHeight
  }
  return tops
}

/**
 * Body-lokal Y qaysi XONA lane'iga tushadi (binary search — 1000 xonada ham pointermove arzon).
 * Guruh sarlavhasiga yoki tashqariga tushsa -1: chaqiruvchi oxirgi haqiqiy xonani saqlab qoladi,
 * ya'ni sarlavha ustidan o'tganda ko'chirish sakrab ketmaydi.
 */
export function roomLaneAtY(
  y: number,
  lanes: Lane[],
  tops: number[],
  rowHeight: number,
  groupHeight: number,
): number {
  if (y < 0 || lanes.length === 0) return -1
  let lo = 0
  let hi = lanes.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const top = tops[mid]
    const height = lanes[mid].kind === "group" ? groupHeight : rowHeight
    if (y < top) hi = mid - 1
    else if (y >= top + height) lo = mid + 1
    else return lanes[mid].kind === "room" ? mid : -1
  }
  return -1
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
