
export const shiftKeys = {
  all: ["shift-session"] as const,
  current: ["shift-session", "current"] as const,
  list: (cursor?: string) => ["shift-session", "list", cursor ?? ""] as const,
  report: (id: string) => ["shift-session", "report", id] as const,
  timeline: (id: string) => ["shift-session", "timeline", id] as const,
}

export const keys = {
  bookingsAll: ["bookings"] as const,
  bookings: (from: string, to: string) => ["bookings", from, to] as const,
  roomBlocksAll: ["room-blocks"] as const,
  roomBlocks: (from: string, to: string) => ["room-blocks", from, to] as const,
  bookingGuestsAll: ["booking-guests"] as const,
  bookingGuests: (bookingId: string | null) => ["booking-guests", bookingId] as const,
  bookingActivityAll: ["booking-activity"] as const,
  bookingActivity: (bookingId: string | null) => ["booking-activity", bookingId] as const,
  rooms: () => ["rooms"] as const,
  branding: () => ["hotel-branding"] as const,
  organizations: () => ["organizations"] as const,
  noticesOrganizations: () => ["notices", "organizations"] as const,
  permissionsMe: () => ["permissions", "me"] as const,
  shift: shiftKeys,
}
