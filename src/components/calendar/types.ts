import type { ReactNode } from "react"


export type CalendarStatus = "booked" | "checked_in" | "checked_out" | "cancelled"

export interface CalendarPayment {
  total: number
  paid: number
}

export interface CalendarRoom {
  id: string
  label: string
  group?: string
  sublabel?: string
  order?: number
  rate?: number
}

export interface CalendarBooking {
  id: string
  roomId: string
  start: string
  end: string
  status: CalendarStatus
  label: string
  sublabel?: string
  payment?: CalendarPayment
  guestConfirmed?: boolean
  checkedInAt?: string | null
  checkedOutAt?: string | null
  createdAt?: string
  meta?: Record<string, unknown>
}

export interface CalendarRange {
  start: string
  days: number
}

export interface StatusVisual {
  bar: string
  text?: string
  hidden?: boolean
}

export type StatusConfig = Record<CalendarStatus, StatusVisual>

export interface CalendarLabels {
  weekdaysShort: string[]
  months: string[]
  nights: (n: number) => string
  money: (amount: number) => string
  statusText: Record<CalendarStatus, string>
  checkInTime: string
  checkOutTime: string
  nightsWord: string
  guest: string
  phone: string
  stay: string
  payment: string
  today: string
  emptyTitle: string
  emptyHint: string
  noRoomsTitle: string
  noRoomsHint: string
  newBooking: string
  checkIn: string
  checkOut: string
  cancel: string
  guestName: string
  guestPhone: string
  room: string
  arrival: string
  departure: string
  save: string
  close: string
  paid: string
  remaining: string
  conflict: string

  edit: string
  discard: string
  confirmed: string
  notConfirmed: string
  history: string
  historyCreated: string
  historyCheckedIn: string
  historyCheckedOut: string
  actions: string
  total: string
  nightlyRate: string
  amount: string
  lockedHint: string
  noChanges: string
}

export interface CalendarDraft {
  roomId: string
  start: string
  end: string
}

export interface CalendarCreateInput extends CalendarDraft {
  guestName: string
  guestPhone?: string
}

export interface BookingEditPatch {
  roomId?: string
  guestName?: string
  guestPhone?: string
  start?: string
  end?: string
  totalAmount?: number
}

export interface ReservationCalendarProps {
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  range: CalendarRange
  today?: string

  dayWidth?: number
  rowHeight?: number
  railWidth?: number
  headerHeight?: number
  groupByFloor?: boolean
  overscan?: number
  statusConfig?: Partial<StatusConfig>
  labels?: Partial<CalendarLabels>
  matchIds?: ReadonlySet<string> | null

  onCreateBooking?: (input: CalendarCreateInput) => void | Promise<void>
  onCheckIn?: (id: string) => void | Promise<void>
  onCheckOut?: (id: string) => void | Promise<void>
  onCancel?: (id: string) => void | Promise<void>
  onSelectBooking?: (booking: CalendarBooking) => void
  onEditBooking?: (id: string, patch: BookingEditPatch) => void | Promise<void>
  onMoveBooking?: (id: string, next: CalendarDraft) => void | Promise<void>

  isLoading?: boolean
  error?: ReactNode
  className?: string
}
