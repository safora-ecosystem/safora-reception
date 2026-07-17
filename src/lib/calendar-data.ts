import { useCallback, useState, type ReactNode } from "react"
import {
  generateMockData,
  type CalendarBooking,
  type CalendarCreateInput,
  type CalendarRoom,
} from "@/components/calendar"


export interface CalendarData {
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  isLoading: boolean
  error: ReactNode | null
  createBooking: (input: CalendarCreateInput) => Promise<void>
  checkIn: (id: string) => Promise<void>
  checkOut: (id: string) => Promise<void>
  cancel: (id: string) => Promise<void>
}

let mockIdSeq = 0

export function useMockCalendarData(roomCount = 24): CalendarData {
  const [seed] = useState(() => generateMockData({ rooms: roomCount }))
  const [bookings, setBookings] = useState<CalendarBooking[]>(seed.bookings)

  const createBooking = useCallback(async (input: CalendarCreateInput) => {
    setBookings((prev) => [
      ...prev,
      {
        id: `bk-new-${mockIdSeq++}`,
        roomId: input.roomId,
        start: input.start,
        end: input.end,
        status: "booked",
        label: input.guestName,
        sublabel: input.guestPhone,
        payment: { total: 0, paid: 0 },
      },
    ])
  }, [])

  const setStatus = useCallback(
    (id: string, status: CalendarBooking["status"]) =>
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b))),
    [],
  )

  const checkIn = useCallback(async (id: string) => setStatus(id, "checked_in"), [setStatus])
  const checkOut = useCallback(async (id: string) => setStatus(id, "checked_out"), [setStatus])
  const cancel = useCallback(async (id: string) => setStatus(id, "cancelled"), [setStatus])

  return {
    rooms: seed.rooms,
    bookings,
    isLoading: false,
    error: null,
    createBooking,
    checkIn,
    checkOut,
    cancel,
  }
}
