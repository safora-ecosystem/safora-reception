import type { ComponentType, ReactNode } from "react"


export type CalendarStatus = "booked" | "checked_in" | "checked_out" | "cancelled" | "blocked"

export type CalendarBlockKind = "maintenance" | "cleaning" | "hold" | "other"

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
  capacity?: number
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
  guestCount?: number
  note?: string | null
  blockKind?: CalendarBlockKind
  meta?: Record<string, unknown>
}

export interface CalendarRange {
  start: string
  days: number
}

export interface StatusVisual {
  bar: string
  text?: string
  border?: string
  strip?: string
  icon?: ComponentType<{ className?: string }>
  hidden?: boolean
}

export type StatusConfig = Record<CalendarStatus, StatusVisual>

export interface CalendarLabels {
  weekdaysShort: string[]
  months: string[]
  nights: (n: number) => string
  money: (amount: number) => string
  statusText: Record<CalendarStatus, string>
  blockKindText: Record<CalendarBlockKind, string>
  checkInTime: string
  checkOutTime: string
  nightsWord: string
  guest: string
  phone: string
  stay: string
  payment: string
  today: string
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

  rooms: string
  roomsSelected: (n: number) => string
  roomSearch: string
  roomsEmpty: string
  busy: string
  selectedBusy: string
  pastStart: string
  summary: string
  quickNights: string
  prepayment: string
  paymentUnpaid: string
  paymentPartial: string
  paymentFull: string
  prepaymentTooBig: string
  create: string
  groupHint: (n: number) => string

  modeBooking: string
  modeBlock: string
  blockTitle: string
  blockReason: string
  blockReasonHint: string
  blockKind: string
  createBlock: string
  blockHint: string

  companions: string
  addGuest: string
  removeGuest: string
  primaryGuest: string
  makePrimary: string
  document: string
  docNumber: string
  docTypeText: Record<string, string>
  note: string
  notePlaceholder: string
  capacityOver: (guests: number, capacity: number) => string
  guestsWord: (n: number) => string

  openChat: string
  duplicate: string
  extendStay: string
  guestQr: string
  unblock: string
}

export interface CalendarDraft {
  roomId: string
  start: string
  end: string
}

export interface CalendarCreateRoom {
  roomId: string
  totalAmount: number
  paidAmount: number
}

export interface CalendarGuest {
  id: string
  fullName: string
  phone: string | null
  docType: string | null
  docNumber: string | null
  isPrimary: boolean
}

export interface CalendarGuestInput {
  fullName: string
  phone?: string
  docType?: string
  docNumber?: string
}

export type CalendarCreateInput =
  | ({ mode: "booking" } & CalendarBookingInput)
  | ({ mode: "block" } & CalendarBlockInput)

export interface CalendarBookingInput {
  start: string
  end: string
  guestName: string
  guestPhone: string
  guestDocType?: string
  guestDocNumber?: string
  guests?: CalendarGuestInput[]
  note?: string
  rooms: CalendarCreateRoom[]
}

export interface CalendarBlockInput {
  start: string
  end: string
  roomIds: string[]
  kind: CalendarBlockKind
  reason?: string
}

export interface BookingEditPatch {
  roomId?: string
  guestName?: string
  guestPhone?: string
  start?: string
  end?: string
  totalAmount?: number
  paidAmount?: number
  note?: string
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
  onSelectBooking?: (booking: CalendarBooking | null) => void

  guests?: CalendarGuest[] | null
  guestsLoading?: boolean
  onAddGuest?: (bookingId: string, guest: CalendarGuestInput) => void | Promise<void>
  onUpdateGuest?: (
    bookingId: string,
    guestId: string,
    patch: Partial<CalendarGuestInput>,
  ) => void | Promise<void>
  onRemoveGuest?: (bookingId: string, guestId: string) => void | Promise<void>
  onSetPrimaryGuest?: (bookingId: string, guestId: string) => void | Promise<void>

  onRemoveBlock?: (id: string) => void | Promise<void>
  onDuplicate?: (booking: CalendarBooking) => void
  onOpenChat?: (booking: CalendarBooking) => void
  onEditBooking?: (id: string, patch: BookingEditPatch) => void | Promise<void>
  onMoveBooking?: (id: string, next: CalendarDraft) => void | Promise<void>

  isLoading?: boolean
  error?: ReactNode
  className?: string
}
