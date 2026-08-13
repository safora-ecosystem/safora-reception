import type { CalendarBooking, CalendarPayment } from "./types"


export function displayPayment(b: CalendarBooking): CalendarPayment | undefined {
  if (!b.folio) return b.payment
  return b.folio.open ? { total: b.folio.total, paid: b.folio.paid } : undefined
}

export function folioElsewhere(b: CalendarBooking): boolean {
  return b.folio != null && !b.folio.open
}
