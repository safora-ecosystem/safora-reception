import type { ReactNode } from "react"


export type CalendarStatus = "booked" | "checked_in" | "checked_out" | "cancelled" | "blocked"

export type CalendarBlockKind = "maintenance" | "cleaning" | "hold" | "other"

export type CalendarBookingSource = "reception" | "channel" | "web"

export interface CalendarPayment {
  total: number
  paid: number
}

export interface CalendarFolio {
  parts: number
  index: number
  last: boolean
  open: boolean
  openRoom: string | null
  prevRoom: string | null
  nextRoom: string | null
  total: number
  extras: number
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
  housekeeping?: "clean" | "dirty" | "in_progress"
}

export interface CalendarOrganization {
  id: string
  name: string
  shortName?: string | null
  contractNumber?: string | null
  inn?: string | null
  contactName?: string | null
  contactPhone?: string | null
  discountPercent?: number | null
  creditLimit?: number | null
  paymentTermDays?: number | null
  balance?: number
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
  organization?: { id: string; name: string; shortName?: string | null } | null
  orgRef?: string | null
  createdBy?: { name: string; role?: string } | null
  source?: CalendarBookingSource
  blockKind?: CalendarBlockKind
  linkId?: string | null
  folio?: CalendarFolio | null
  meta?: Record<string, unknown>
}

export interface CalendarRange {
  start: string
  days: number
}


export type CalendarBarMoney = "glyph" | "total" | "remaining" | "hidden"

export type CalendarDensity = "compact" | "default" | "roomy"

export interface CalendarViewPrefs {
  barMoney: CalendarBarMoney
  density: CalendarDensity
  guestBadge: boolean
  cleaningBadge: boolean
  weekendTint: boolean
  animations: boolean
}

export interface StatusVisual {
  bar: string
  text?: string
  labelClass?: string
  border?: string
  strip?: string
  hidden?: boolean
}

export type StatusConfig = Record<CalendarStatus, StatusVisual>

export interface CalendarLabels {
  weekdaysShort: string[]
  months: string[]
  formatDay: (iso: string) => string
  nights: (n: number) => string
  money: (amount: number) => string
  moneyShort: (amount: number) => string
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
  bookedBy: string
  bookingSource: Record<CalendarBookingSource, string>
  paidFully: string
  paidPartly: string
  paidNone: string
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
  roomsFree: (n: number) => string
  roomsOnlyFree: string
  roomsAll: string
  roomsNone: string
  roomsClear: string
  roomsPickHint: string
  capacityWord: (n: number) => string
  busy: string
  selectedBusy: string
  pastStart: string
  needGuestName: string
  needGuestPhone: string
  needCompanionName: string
  needRoom: string
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
  modeCorporate: string
  modeBlock: string
  blockTitle: string
  blockReason: string
  blockReasonHint: string
  blockKind: string
  createBlock: string
  blockHint: string

  companions: string
  roomGuests: string
  addGuest: string
  removeGuest: string
  primaryGuest: string
  makePrimary: string
  document: string
  docNumber: string
  docTypeNone: string
  docTypeText: Record<string, string>
  note: string
  notePlaceholder: string
  capacityOver: (guests: number, capacity: number) => string
  guestsWord: (n: number) => string

  rateNotSet: string
  rateNotSetError: string
  totalBelowPaid: string

  extraGuestRate: string
  extraGuests: string
  extraGuestsBreakdown: (guests: number, nights: number) => string

  openChat: string
  duplicate: string
  extendStay: string
  guestQr: string
  unblock: string

  moveConfirmTitle: string
  moveConfirmHint: string
  moveConfirmAction: string
  moveFrom: string
  moveTo: string

  split: string
  splitTitle: string
  splitHint: string
  splitDate: string
  splitRoom: string
  splitFirst: string
  splitSecond: string
  splitBusy: string
  splitTooShort: string
  splitLinked: string
  confirmSplit: string
  splitFirstAmount: string
  splitTotalBefore: string
  splitTotalAfter: string
  splitMoveNow: string
  splitMoveNowHint: string

  splitPart: (index: number, parts: number) => string
  splitFolioElsewhere: (room: string) => string
  splitFolioElsewhereHint: string
  splitFolioWhole: (parts: number) => string
  splitFromRoom: (room: string) => string
  splitToRoom: (room: string) => string
  moveNext: (room: string) => string
  moveNextHint: (from: string, to: string) => string
  moveNextConfirm: string

  invoice: string
  invoiceTitle: string
  invoiceNumber: string
  invoiceIssue: string
  invoicePrint: string
  invoiceExcel: string
  invoiceStale: string

  paymentHistory: string
  receivePayment: string
  paymentNotePlaceholder: string
  paymentMethodText: Record<string, string>
  voidPayment: string
  voidReasonPlaceholder: string
  voidCashReturned: string
  voidCashKept: string
  voided: string
  paymentOverRemaining: string
  paidReadOnlyHint: string
  confirm: string

  activityText: Record<string, string>
  activityFallback: string
  activityFieldText: Record<string, string>

  organization: string
  corporateTitle: string
  organizationPick: string
  organizationSearch: string
  organizationEmpty: string
  orgRef: string
  orgRefHint: string
  orgDiscount: (percent: number) => string
  orgBalance: string
  orgCreditLimit: string
  orgOverLimit: (over: number) => string
  corporateDiscountLine: string
  corporateBilling: string
  corporateBillingHint: string
  corporateBooking: string
  corporateNoCash: string
  rooming: string
  roomingHint: string
  roomingPaste: string
  roomingPasteHint: string
  roomingApply: string
  roomingRoomEmpty: string
  needOrganization: string
  needRoomingName: string

  viewSettings: string
  viewBarMoney: string
  viewBarMoneyGlyph: string
  viewBarMoneyTotal: string
  viewBarMoneyRemaining: string
  viewBarMoneyHidden: string
  viewDensity: string
  viewDensityCompact: string
  viewDensityDefault: string
  viewDensityRoomy: string
  viewGuestBadge: string
  viewCleaningBadge: string
  viewWeekendTint: string
  viewAnimations: string
  viewReset: string

  debtOnCheckOut: (remaining: number) => string
  checkOutAnyway: string
  cancelPaidWarning: (paid: number) => string
  cancelAnyway: string
  cancelCheckedInWarning: (paid: number) => string
  cancelReasonLabel: string
  cancelReasonPlaceholder: string
  cancelReasonRequired: string
  cancelCheckedInConfirm: string
  earlyCheckInWarning: (date: string) => string
  checkInAnyway: string
  roomOccupiedHint: string
  back: string
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
  eventId?: string

  guestName?: string
  guestPhone?: string
  guestDocType?: string
  guestDocNumber?: string
  guests?: CalendarGuestInput[]
}

export interface CalendarPaymentEntry {
  id: string
  amount: number
  method: string
  note?: string | null
  receivedByName?: string | null
  at?: string
  voided?: boolean
  voidReason?: string | null
  canVoid?: boolean
}

export interface CalendarActivityEntry {
  id: string
  action: string
  actorName?: string | null
  at: string
  data?: Record<string, unknown> | null
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
  guestName?: string
  guestPhone?: string
  guestDocType?: string
  guestDocNumber?: string
  guests?: CalendarGuestInput[]
  note?: string
  organizationId?: string
  orgRef?: string
  method?: "cash" | "card" | "transfer"
  rooms: CalendarCreateRoom[]
}

export interface CalendarSplitInput {
  splitDate: string
  roomId: string
  totalAmount?: number
  firstTotalAmount?: number
  moveNow?: boolean
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
  note?: string
}

export interface ReservationCalendarProps {
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  organizations?: CalendarOrganization[]
  range: CalendarRange
  today?: string
  minStart?: string | null

  dayWidth?: number
  rowHeight?: number
  railWidth?: number
  headerHeight?: number
  groupByFloor?: boolean
  overscan?: number
  barMoney?: CalendarBarMoney
  showGuestCountBadge?: boolean
  showCleaningBadge?: boolean
  weekendTint?: boolean
  entryAnimations?: boolean
  statusConfig?: Partial<StatusConfig>
  splitTraces?: "hover" | "always"
  labels?: Partial<CalendarLabels>
  matchIds?: ReadonlySet<string> | null

  onCreateBooking?: (input: CalendarCreateInput) => void | Promise<void>
  onCheckIn?: (id: string) => void | Promise<void>
  onCheckOut?: (id: string) => void | Promise<void>
  onCancel?: (id: string, reason?: string) => void | Promise<void>
  canCancelCheckedIn?: boolean
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

  payments?: CalendarPaymentEntry[] | null
  onRecordPayment?: (
    bookingId: string,
    input: {
      amount: number
      method: "cash" | "card" | "transfer"
      note?: string
      eventId: string
    },
  ) => void | Promise<void>
  onVoidPayment?: (
    bookingId: string,
    paymentId: string,
    input: {
      reason: string
      cashReturned?: boolean
    },
  ) => void | Promise<void>
  activity?: CalendarActivityEntry[] | null
  activityLoading?: boolean

  onRemoveBlock?: (id: string) => void | Promise<void>
  onDuplicate?: (booking: CalendarBooking) => void
  onOpenChat?: (booking: CalendarBooking) => void
  onEditBooking?: (id: string, patch: BookingEditPatch) => void | Promise<void>
  onMoveBooking?: (id: string, next: CalendarDraft) => void | Promise<void>
  onSplitBooking?: (id: string, input: CalendarSplitInput) => void | Promise<void>
  onMoveNext?: (id: string) => void | Promise<void>
  onInvoice?: (booking: CalendarBooking) => void
  onMoveConflict?: () => void

  isLoading?: boolean
  error?: ReactNode
  className?: string
}
