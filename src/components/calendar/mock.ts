import { epochDay, isoFromEpochDay } from "./geometry"
import type { CalendarBooking, CalendarRoom, CalendarStatus } from "./types"


function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ROOM_TYPES = ["Standart", "Standart", "Lyuks", "Yarim lyuks", "Oila", "Deluxe"]
const FIRST = [
  "Aziz", "Dilnoza", "Sardor", "Malika", "Jasur", "Nigora", "Bekzod", "Kamola",
  "Ravshan", "Zilola", "Otabek", "Sevara", "Ulug'bek", "Gulnora", "Sherzod", "Madina",
]
const LAST = [
  "Karimov", "Rahimova", "Yusupov", "Ibragimova", "Tosheva", "Aliyev",
  "Sobirov", "Ergasheva", "Nazarov", "Qodirova",
]

export interface MockOptions {
  rooms?: number
  roomsPerFloor?: number
  today?: string
  seed?: number
}

export function generateMockData(opts: MockOptions = {}): {
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
} {
  const roomCount = opts.rooms ?? 24
  const perFloor = opts.roomsPerFloor ?? 12
  const today = opts.today ?? new Date().toLocaleDateString("en-CA")
  const rnd = mulberry32(opts.seed ?? (0x51af0 ^ roomCount))
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

  const rooms: CalendarRoom[] = []
  for (let i = 0; i < roomCount; i++) {
    const floor = Math.floor(i / perFloor) + 1
    const num = floor * 100 + (i % perFloor) + 1
    rooms.push({
      id: `room-${num}`,
      label: String(num),
      group: `${floor}-qavat`,
      sublabel: pick(ROOM_TYPES),
      order: num,
    })
  }

  const t = epochDay(today)
  const windowStart = t - 20
  const windowEnd = t + 45
  const bookings: CalendarBooking[] = []
  let seq = 0

  for (const room of rooms) {
    let cursor = windowStart + Math.floor(rnd() * 6)
    while (cursor < windowEnd) {
      cursor += Math.floor(rnd() * 4) // bo'sh kunlar (gap)
      if (cursor >= windowEnd) break
      const nights = 1 + Math.floor(rnd() * 6)
      const start = cursor
      const end = cursor + nights

      let status: CalendarStatus
      const roll = rnd()
      if (end <= t) status = roll < 0.12 ? "cancelled" : "checked_out"
      else if (start <= t && end > t) status = "checked_in"
      else status = roll < 0.08 ? "cancelled" : "booked"

      const total = (1 + Math.floor(rnd() * 9)) * 150000 // ~150k … 1.5M so'm
      let paidRatio: number
      if (status === "checked_out") paidRatio = rnd() < 0.85 ? 1 : rnd()
      else if (status === "checked_in") paidRatio = rnd() < 0.5 ? 1 : 0.3 + rnd() * 0.5
      else paidRatio = rnd() < 0.4 ? 0 : rnd() < 0.7 ? 0.5 : 1

      bookings.push({
        id: `bk-${seq++}`,
        roomId: room.id,
        start: isoFromEpochDay(start),
        end: isoFromEpochDay(end),
        status,
        label: `${pick(FIRST)} ${pick(LAST)}`,
        sublabel: `+998 ${90 + Math.floor(rnd() * 10)} ${String(100 + Math.floor(rnd() * 899)).padStart(3, "0")}-${String(Math.floor(rnd() * 100)).padStart(2, "0")}-${String(Math.floor(rnd() * 100)).padStart(2, "0")}`,
        payment: { total, paid: Math.round(total * paidRatio) },
      })
      cursor = end
    }
  }

  return { rooms, bookings }
}
