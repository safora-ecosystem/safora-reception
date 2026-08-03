import { useMemo } from "react"
import { barRect, epochDay, type Lane } from "./geometry"
import type { CalendarBooking } from "./types"


export interface SplitTrace {
  id: string
  from: CalendarBooking
  to: CalendarBooking
}


export interface TraceConnector {
  id: string
  linkId: string | null
  ax: number
  ay: number
  bx: number
  by: number
}

export function buildSplitTraces(bookings: CalendarBooking[]): SplitTrace[] {
  const chains = new Map<string, CalendarBooking[]>()
  for (const b of bookings) {
    if (!b.linkId || b.status === "cancelled") continue
    const arr = chains.get(b.linkId)
    if (arr) arr.push(b)
    else chains.set(b.linkId, [b])
  }

  const traces: SplitTrace[] = []
  for (const chain of chains.values()) {
    if (chain.length < 2) continue
    chain.sort((a, b) => epochDay(a.start) - epochDay(b.start))
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1]
      const seg = chain[i]
      if (prev.roomId === seg.roomId) continue
      traces.push({ id: seg.id, from: prev, to: seg })
    }
  }
  return traces
}


export function useTraceConnectors(
  bookings: CalendarBooking[],
  lanes: Lane[],
  laneTops: number[],
  rowHeight: number,
  originDay: number,
  dayWidth: number,
  bodyWidth: number,
  checkInFrac: number,
  checkOutFrac: number,
): TraceConnector[] {
  return useMemo(() => {
    const traces = buildSplitTraces(bookings)
    if (traces.length === 0) return []

    const laneOf = new Map<string, number>()
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i]
      if (lane.kind === "room") laneOf.set(lane.room.id, i)
    }

    const out: TraceConnector[] = []
    for (const t of traces) {
      const fromLane = laneOf.get(t.from.roomId)
      const toLane = laneOf.get(t.to.roomId)
      if (fromLane == null || toLane == null) continue

      const a = barRect(t.from.start, t.from.end, originDay, dayWidth, bodyWidth, checkInFrac, checkOutFrac)
      const b = barRect(t.to.start, t.to.end, originDay, dayWidth, bodyWidth, checkInFrac, checkOutFrac)
      if (a.cull && b.cull) continue

      out.push({
        id: t.id,
        linkId: t.to.linkId ?? null,
        ax: a.left + a.width,
        ay: laneTops[fromLane] + rowHeight / 2,
        bx: b.left,
        by: laneTops[toLane] + rowHeight / 2,
      })
    }
    return out
  }, [bookings, lanes, laneTops, rowHeight, originDay, dayWidth, bodyWidth, checkInFrac, checkOutFrac])
}

const OVERLAP = 8

export function connectorPath(c: TraceConnector, radius = 10): string {
  const dx = c.bx - c.ax
  const dy = c.by - c.ay
  const sx = Math.sign(dx) || 1
  const sy = Math.sign(dy) || 1
  const mx = c.ax + dx / 2
  const start = c.ax - sx * OVERLAP
  const end = c.bx + sx * OVERLAP
  const r = Math.max(0, Math.min(radius, Math.abs(dx) / 4, Math.abs(dy) / 2))
  if (r === 0) return `M ${start} ${c.ay} L ${end} ${c.by}`
  return [
    `M ${start} ${c.ay}`,
    `L ${mx - sx * r} ${c.ay}`,
    `Q ${mx} ${c.ay} ${mx} ${c.ay + sy * r}`,
    `L ${mx} ${c.by - sy * r}`,
    `Q ${mx} ${c.by} ${mx + sx * r} ${c.by}`,
    `L ${end} ${c.by}`,
  ].join(" ")
}
