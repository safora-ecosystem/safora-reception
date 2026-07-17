export { ReservationCalendar, type ReservationCalendarHandle } from "./reservation-calendar"
export { defaultStatusConfig, resolveStatusConfig } from "./status-config"
export { defaultLabels, resolveLabels } from "./labels"
export { addDays, epochDay, isoFromEpochDay, nightsBetween, hasConflict } from "./geometry"
export { generateMockData, type MockOptions } from "./mock"
export type {
  CalendarStatus,
  CalendarRoom,
  CalendarBooking,
  CalendarPayment,
  CalendarRange,
  CalendarLabels,
  CalendarDraft,
  CalendarCreateInput,
  StatusVisual,
  StatusConfig,
  ReservationCalendarProps,
} from "./types"
