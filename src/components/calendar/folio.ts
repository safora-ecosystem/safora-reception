import type { CalendarBooking, CalendarPayment } from "./types"


export function displayPayment(b: CalendarBooking): CalendarPayment | undefined {
  if (!b.folio) return b.payment
  return b.folio.open
    ? { total: b.folio.total, paid: b.folio.paid, extras: b.folio.extras }
    : undefined
}

export function folioDue(p: CalendarPayment): number {
  return p.total + (p.extras ?? 0)
}

export function folioElsewhere(b: CalendarBooking): boolean {
  return b.folio != null && !b.folio.open
}
