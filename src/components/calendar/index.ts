export { ReservationCalendar, type ReservationCalendarHandle } from "./reservation-calendar"
export { useCalendarMetrics, type CalendarMetrics } from "./use-calendar-metrics"
export { defaultStatusConfig, resolveStatusConfig } from "./status-config"
export { calendarLabels, resolveLabels } from "./labels"
export { addDays, epochDay, isoFromEpochDay, nightsBetween, hasConflict } from "./geometry"
export { generateMockData, type MockOptions } from "./mock"
export type {
  CalendarStatus,
  CalendarBlockKind,
  CalendarRoom,
  CalendarBooking,
  CalendarOrganization,
  CalendarPayment,
  CalendarRange,
  CalendarLabels,
  CalendarDraft,
  CalendarCreateInput,
  CalendarBookingInput,
  CalendarBlockInput,
  CalendarCreateRoom,
  CalendarSplitInput,
  CalendarGuest,
  CalendarGuestInput,
  CalendarPaymentEntry,
  CalendarActivityEntry,
  BookingEditPatch,
  StatusVisual,
  StatusConfig,
  ReservationCalendarProps,
} from "./types"
