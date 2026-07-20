import { useCallback, useMemo, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  addDays,
  generateMockData,
  nightsBetween,
  type BookingEditPatch,
  type CalendarBooking,
  type CalendarCreateInput,
  type CalendarDraft,
  type CalendarRange,
  type CalendarRoom,
} from "@/components/calendar"
import {
  ApiError,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  createBooking as apiCreateBooking,
  listBookings,
  listRooms,
  updateBooking as apiUpdateBooking,
  type Booking,
  type Room,
  type UpdateBookingBody,
} from "@/lib/api"


export interface CalendarData {
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  isLoading: boolean
  error: ReactNode | null
  createBooking: (input: CalendarCreateInput) => Promise<void>
  checkIn: (id: string) => Promise<void>
  checkOut: (id: string) => Promise<void>
  cancel: (id: string) => Promise<void>
  editBooking: (id: string, patch: BookingEditPatch) => Promise<void>
  moveBooking: (id: string, next: CalendarDraft) => Promise<void>
}

let mockIdSeq = 0

export function useMockCalendarData(roomCount = 24): CalendarData {
  const [seed] = useState(() => generateMockData({ rooms: roomCount }))
  const [bookings, setBookings] = useState<CalendarBooking[]>(seed.bookings)

  const patchOne = useCallback(
    (id: string, fn: (b: CalendarBooking) => CalendarBooking) =>
      setBookings((prev) => prev.map((b) => (b.id === id ? fn(b) : b))),
    [],
  )

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
        guestConfirmed: false,
        createdAt: new Date().toISOString(),
      },
    ])
  }, [])

  // Status flip'lari real momentni ham shtamplaydi — detal modalidagi timeline mock rejimida
  // ham jonli ko'rinsin (real adapter bu qiymatlarni backend'dan oladi).
  const checkIn = useCallback(
    async (id: string) => patchOne(id, (b) => ({ ...b, status: "checked_in", checkedInAt: new Date().toISOString() })),
    [patchOne],
  )
  const checkOut = useCallback(
    async (id: string) => patchOne(id, (b) => ({ ...b, status: "checked_out", checkedOutAt: new Date().toISOString() })),
    [patchOne],
  )
  const cancel = useCallback(async (id: string) => patchOne(id, (b) => ({ ...b, status: "cancelled" })), [patchOne])

  const editBooking = useCallback(
    async (id: string, patch: BookingEditPatch) =>
      patchOne(id, (b) => ({
        ...b,
        ...(patch.roomId !== undefined ? { roomId: patch.roomId } : {}),
        ...(patch.start !== undefined ? { start: patch.start } : {}),
        ...(patch.end !== undefined ? { end: patch.end } : {}),
        ...(patch.guestName !== undefined ? { label: patch.guestName } : {}),
        ...(patch.guestPhone !== undefined ? { sublabel: patch.guestPhone } : {}),
        ...(patch.totalAmount !== undefined
          ? { payment: { total: patch.totalAmount, paid: b.payment?.paid ?? 0 } }
          : {}),
      })),
    [patchOne],
  )

  const moveBooking = useCallback(
    async (id: string, next: CalendarDraft) =>
      patchOne(id, (b) => ({ ...b, roomId: next.roomId, start: next.start, end: next.end })),
    [patchOne],
  )

  return {
    rooms: seed.rooms,
    bookings,
    isLoading: false,
    error: null,
    createBooking,
    checkIn,
    checkOut,
    cancel,
    editBooking,
    moveBooking,
  }
}

// ── Real core-api adapteri ────────────────────────────────────────────────────

function mapRoom(r: Room): CalendarRoom {
  return {
    id: r.id,
    label: r.number,
    group: r.floor != null ? `${r.floor}-qavat` : undefined,
    sublabel: r.type || undefined,
    order: Number.parseInt(r.number, 10) || undefined,
    rate: r.rate != null ? Number(r.rate) : undefined,
  }
}

function mapBooking(b: Booking): CalendarBooking {
  const total = b.totalAmount != null ? Number(b.totalAmount) : undefined
  return {
    id: b.id,
    roomId: b.room.id,
    start: b.checkInDate.slice(0, 10),
    end: b.checkOutDate.slice(0, 10),
    status: b.status,
    label: b.guestName,
    sublabel: b.guestPhone ?? undefined,
    payment: total != null ? { total, paid: Number(b.paidAmount ?? 0) } : undefined,
    guestConfirmed: b.guestConfirmed,
    checkedInAt: b.checkedInAt,
    checkedOutAt: b.checkedOutAt,
    createdAt: b.createdAt,
  }
}

/** Kalendar domen nomlari (start/end) → API nomlari (checkInDate/checkOutDate). Faqat mavjud
    kalitlar uzatiladi: PATCH'da `undefined` yuborish maydonni "tozalash" deb tushunilmasin. */
function toUpdateBody(patch: BookingEditPatch): UpdateBookingBody {
  return {
    ...(patch.roomId !== undefined ? { roomId: patch.roomId } : {}),
    ...(patch.guestName !== undefined ? { guestName: patch.guestName } : {}),
    ...(patch.guestPhone !== undefined ? { guestPhone: patch.guestPhone } : {}),
    ...(patch.start !== undefined ? { checkInDate: patch.start } : {}),
    ...(patch.end !== undefined ? { checkOutDate: patch.end } : {}),
    ...(patch.totalAmount !== undefined ? { totalAmount: patch.totalAmount } : {}),
  }
}

function errMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return "Holat o'zgardi — sahifani yangilang"
    const body = e.body as { message?: unknown } | null
    if (body && typeof body.message === "string") return body.message
  }
  return fallback
}

/**
 * Real core-api manbasi. `enabled=false` bo'lsa so'rov yubormaydi (mock rejimida ishlatiladi —
 * ikkala hook ham shartsiz chaqiriladi, faqat biri faol). Realizatsiya: mock'ni shunga almashtirish.
 */
export function useApiCalendarData(range: CalendarRange, options?: { enabled?: boolean }): CalendarData {
  const enabled = options?.enabled ?? true
  const qc = useQueryClient()
  const from = range.start
  const to = addDays(range.start, range.days) // oynaning exclusive oxiri

  // Xonalar kamdan-kam o'zgaradi (owner tahrirlaydi) — uzoq staleTime, poll kerak emas.
  const roomsQ = useQuery({ queryKey: ["rooms"], queryFn: listRooms, enabled, staleTime: 5 * 60_000 })
  // Bronlar — UMUMIY ish stoli: bir necha resepshn xodimi bir vaqtda bron ochadi/kirish belgilaydi.
  // Shuning uchun global `refetchOnWindowFocus: false` shu yerda ATAYLAB bekor qilinadi + 30s poll.
  // Fon tab'da poll to'xtaydi (refetchIntervalInBackground default false) → bekorga API yuki yo'q.
  const bookingsQ = useQuery({
    queryKey: ["bookings", from, to],
    queryFn: () => listBookings(from, to),
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })

  const rooms = useMemo<CalendarRoom[]>(() => (roomsQ.data ?? []).map(mapRoom), [roomsQ.data])
  const bookings = useMemo<CalendarBooking[]>(() => (bookingsQ.data ?? []).map(mapBooking), [bookingsQ.data])
  const rateById = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of roomsQ.data ?? []) m.set(r.id, r.rate != null ? Number(r.rate) : 0)
    return m
  }, [roomsQ.data])

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["bookings"] }), [qc])

  const onError = useCallback(
    (e: unknown, fallback: string) => {
      toast.error(errMessage(e, fallback))
      if (e instanceof ApiError && e.status === 409) invalidate()
    },
    [invalidate],
  )

  const createBooking = useCallback(
    async (input: CalendarCreateInput) => {
      try {
        const totalAmount = (rateById.get(input.roomId) ?? 0) * nightsBetween(input.start, input.end)
        await apiCreateBooking({
          roomId: input.roomId,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          checkInDate: input.start,
          checkOutDate: input.end,
          totalAmount,
        })
        toast.success("Bron yaratildi")
        invalidate()
      } catch (e) {
        onError(e, "Bron yaratilmadi")
      }
    },
    [rateById, invalidate, onError],
  )

  const checkIn = useCallback(
    async (id: string) => {
      try {
        await checkInBooking(id)
        toast.success("Kirish belgilandi")
        invalidate()
      } catch (e) {
        onError(e, "Kirish bajarilmadi")
      }
    },
    [invalidate, onError],
  )

  const checkOut = useCallback(
    async (id: string) => {
      try {
        await checkOutBooking(id)
        toast.success("Chiqish belgilandi")
        invalidate()
      } catch (e) {
        onError(e, "Chiqish bajarilmadi")
      }
    },
    [invalidate, onError],
  )

  const cancel = useCallback(
    async (id: string) => {
      try {
        await cancelBooking(id)
        toast.success("Bron bekor qilindi")
        invalidate()
      } catch (e) {
        onError(e, "Bekor qilinmadi")
      }
    },
    [invalidate, onError],
  )

  const editBooking = useCallback(
    async (id: string, patch: BookingEditPatch) => {
      const body = toUpdateBody(patch)
      if (Object.keys(body).length === 0) return // hech narsa o'zgarmagan — so'rov yubormaymiz
      try {
        await apiUpdateBooking(id, body)
        toast.success("Bron yangilandi")
        invalidate()
      } catch (e) {
        onError(e, "Bron yangilanmadi")
      }
    },
    [invalidate, onError],
  )

  const moveBooking = useCallback(
    async (id: string, next: CalendarDraft) => {
      try {
        await apiUpdateBooking(id, {
          roomId: next.roomId,
          checkInDate: next.start,
          checkOutDate: next.end,
        })
        toast.success("Bron ko'chirildi")
        invalidate()
      } catch (e) {
        onError(e, "Bron ko'chirilmadi")
      }
    },
    [invalidate, onError],
  )

  const error = enabled && (roomsQ.error || bookingsQ.error) ? "Ma'lumot yuklanmadi" : null

  return {
    rooms,
    bookings,
    isLoading: enabled && (roomsQ.isLoading || bookingsQ.isLoading),
    error,
    createBooking,
    checkIn,
    checkOut,
    cancel,
    editBooking,
    moveBooking,
  }
}
