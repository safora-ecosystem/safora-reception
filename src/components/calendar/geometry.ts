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

export function barClipPath(
  width: number,
  height: number,
  clippedStart: boolean,
  clippedEnd: boolean,
): string {
  const k = Math.min(Math.round(height * 0.5), Math.round(width * 0.34), 16)
  if (k < 3) return ""
  const leftTop = clippedStart ? 0 : k
  const rightBottom = clippedEnd ? width : width - k
  return `polygon(${leftTop}px 0, ${width}px 0, ${rightBottom}px ${height}px, 0 ${height}px)`
}

/**
 * Drag/ghost overlay'ni AYNAN CalendarBar shakliga soladi — ref bilan imperativ (render'dan
 * tashqari, 60fps). Ikki qatlam: `el` = tashqi chegara qatlami, birinchi bolasi = ichki fill
 * (2px inset), ikkalasiga ham diagonal `barClipPath`. Shu sabab tanlov to'rtburchak emas, "aktiv
 * bron" ko'rinishida bo'ladi. `conflict` → `data-conflict` (rang CSS'da almashadi). Yaratish ham,
 * ko'chirish ham SHU bilan bo'yaydi, shakl bir manbadan keladi.
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
  el.style.clipPath = barClipPath(width, height, clippedStart, clippedEnd) || "none"
  el.dataset.conflict = conflict ? "true" : "false"

  const inner = el.firstElementChild as HTMLElement | null
  if (inner) {
    const inset = 2
    const iw = Math.max(0, width - 2 * inset)
    const ih = Math.max(0, height - 2 * inset)
    inner.style.left = `${inset}px`
    inner.style.top = `${inset}px`
    inner.style.width = `${iw}px`
    inner.style.height = `${ih}px`
    inner.style.clipPath = barClipPath(iw, ih, clippedStart, clippedEnd) || "none"
  }
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

function compareRooms(a: CalendarRoom, b: CalendarRoom): number {
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
