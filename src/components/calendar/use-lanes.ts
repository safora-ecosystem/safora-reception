import { useMemo } from "react"
import { barRect, buildLanes, type Lane, type PositionedBar } from "./geometry"
import type { CalendarBooking, CalendarRoom, StatusConfig } from "./types"

export function useLanes(
  rooms: CalendarRoom[],
  groupByFloor: boolean,
  collapsed: ReadonlySet<string>,
): Lane[] {
  return useMemo(() => buildLanes(rooms, groupByFloor, collapsed), [rooms, groupByFloor, collapsed])
}

export function useBookingIndex(
  bookings: CalendarBooking[],
  originDay: number,
  dayWidth: number,
  bodyWidth: number,
  statusConfig: StatusConfig,
): Map<string, PositionedBar[]> {
  return useMemo(() => {
    const map = new Map<string, PositionedBar[]>()
    for (const b of bookings) {
      if (statusConfig[b.status]?.hidden) continue
      const rect = barRect(b.start, b.end, originDay, dayWidth, bodyWidth)
      if (rect.cull) continue
      const arr = map.get(b.roomId)
      if (arr) arr.push({ booking: b, rect })
      else map.set(b.roomId, [{ booking: b, rect }])
    }
    return map
  }, [bookings, originDay, dayWidth, bodyWidth, statusConfig])
}
