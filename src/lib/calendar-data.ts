import { useCallback, useMemo, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  addDays,
  defaultLabels,
  generateMockData,
  type BookingEditPatch,
  type CalendarBooking,
  type CalendarCreateInput,
  type CalendarDraft,
  type CalendarRange,
  type CalendarRoom,
} from "@/components/calendar"
import {
  ApiError,
  addBookingGuest,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  createBookings as apiCreateBookings,
  createRoomBlock,
  getBooking,
  listBookings,
  listRoomBlocks,
  listRooms,
  removeBookingGuest,
  removeRoomBlock,
  setPrimaryGuest as apiSetPrimaryGuest,
  updateBooking as apiUpdateBooking,
  updateBookingGuest,
  type Booking,
  type BookingGuest,
  type GuestInput,
  type Room,
  type RoomBlock,
  type UpdateBookingBody,
} from "@/lib/api"

const BLOCK_PREFIX = "block:"
export const isBlockId = (id: string) => id.startsWith(BLOCK_PREFIX)
export const blockIdOf = (id: string) => id.slice(BLOCK_PREFIX.length)


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
  removeBlock: (id: string) => Promise<void>

  selectGuestsFor: (bookingId: string | null) => void
  guests: BookingGuest[] | null
  guestsLoading: boolean
  addGuest: (bookingId: string, guest: LooseGuestInput) => Promise<void>
  updateGuest: (bookingId: string, guestId: string, patch: Partial<LooseGuestInput>) => Promise<void>
  removeGuest: (bookingId: string, guestId: string) => Promise<void>
  makeGuestPrimary: (bookingId: string, guestId: string) => Promise<void>
}

type LooseGuestInput = { fullName: string; phone?: string; docType?: string; docNumber?: string }

function toGuestPatch(g: Partial<LooseGuestInput>): Partial<GuestInput> {
  return {
    ...(g.fullName !== undefined ? { fullName: g.fullName } : {}),
    ...(g.phone !== undefined ? { phone: g.phone } : {}),
    ...(g.docType ? { docType: g.docType as GuestInput["docType"] } : {}),
    ...(g.docNumber !== undefined ? { docNumber: g.docNumber } : {}),
  }
}

function toGuestInput(g: LooseGuestInput): GuestInput {
  return { ...toGuestPatch(g), fullName: g.fullName }
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
    const createdAt = new Date().toISOString()
    if (input.mode === "block") {
      setBookings((prev) => [
        ...prev,
        ...input.roomIds.map((roomId) => ({
          id: `blk-new-${mockIdSeq++}`,
          roomId,
          start: input.start,
          end: input.end,
          status: "blocked" as const,
          label: defaultLabels.blockKindText[input.kind],
          sublabel: input.reason,
          blockKind: input.kind,
          createdAt,
        })),
      ])
      return
    }
    setBookings((prev) => [
      ...prev,
      ...input.rooms.map((r) => ({
        id: `bk-new-${mockIdSeq++}`,
        roomId: r.roomId,
        start: input.start,
        end: input.end,
        status: "booked" as const,
        label: input.guestName,
        sublabel: input.guestPhone,
        payment: { total: r.totalAmount, paid: r.paidAmount },
        guestConfirmed: false,
        guestCount: 1 + (input.guests?.length ?? 0),
        note: input.note,
        createdAt,
      })),
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
        ...(patch.totalAmount !== undefined || patch.paidAmount !== undefined
          ? {
              payment: {
                total: patch.totalAmount ?? b.payment?.total ?? 0,
                paid: patch.paidAmount ?? b.payment?.paid ?? 0,
              },
            }
          : {}),
      })),
    [patchOne],
  )

  const moveBooking = useCallback(
    async (id: string, next: CalendarDraft) =>
      patchOne(id, (b) => ({ ...b, roomId: next.roomId, start: next.start, end: next.end })),
    [patchOne],
  )

  const removeBlock = useCallback(
    async (id: string) => setBookings((prev) => prev.filter((b) => b.id !== id)),
    [],
  )

  // Mock rejimida mehmonlar ro'yxati in-memory: tanlangan bron uchun asosiy mehmon + qo'shilganlar.
  const [guestsByBooking, setGuestsByBooking] = useState<Record<string, BookingGuest[]>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const guests = useMemo(() => {
    if (!selectedId) return null
    const existing = guestsByBooking[selectedId]
    if (existing) return existing
    const b = bookings.find((x) => x.id === selectedId)
    if (!b) return null
    return [
      { id: `${selectedId}:primary`, fullName: b.label, phone: b.sublabel ?? null, docType: null, docNumber: null, isPrimary: true },
    ]
  }, [selectedId, guestsByBooking, bookings])

  const patchGuests = useCallback(
    (bookingId: string, fn: (list: BookingGuest[]) => BookingGuest[], current: BookingGuest[]) =>
      setGuestsByBooking((prev) => ({ ...prev, [bookingId]: fn(prev[bookingId] ?? current) })),
    [],
  )

  const addGuest = useCallback(
    async (bookingId: string, guest: LooseGuestInput) =>
      patchGuests(
        bookingId,
        (list) => [
          ...list,
          {
            id: `g-${mockIdSeq++}`,
            fullName: guest.fullName,
            phone: guest.phone ?? null,
            docType: (guest.docType ?? null) as BookingGuest["docType"],
            docNumber: guest.docNumber ?? null,
            isPrimary: false,
          },
        ],
        guests ?? [],
      ),
    [patchGuests, guests],
  )

  const updateGuest = useCallback(
    async (bookingId: string, guestId: string, patch: Partial<LooseGuestInput>) =>
      patchGuests(
        bookingId,
        (list) =>
          list.map((g) =>
            g.id === guestId
              ? {
                  ...g,
                  ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
                  ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
                  ...(patch.docType !== undefined
                    ? { docType: patch.docType as BookingGuest["docType"] }
                    : {}),
                  ...(patch.docNumber !== undefined ? { docNumber: patch.docNumber } : {}),
                }
              : g,
          ),
        guests ?? [],
      ),
    [patchGuests, guests],
  )

  const removeGuest = useCallback(
    async (bookingId: string, guestId: string) =>
      patchGuests(bookingId, (list) => list.filter((g) => g.id !== guestId), guests ?? []),
    [patchGuests, guests],
  )

  const makeGuestPrimary = useCallback(
    async (bookingId: string, guestId: string) => {
      patchGuests(bookingId, (list) => list.map((g) => ({ ...g, isPrimary: g.id === guestId })), guests ?? [])
      const next = (guests ?? []).find((g) => g.id === guestId)
      if (next) patchOne(bookingId, (b) => ({ ...b, label: next.fullName, sublabel: next.phone ?? undefined }))
    },
    [patchGuests, guests, patchOne],
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
    removeBlock,
    selectGuestsFor: setSelectedId,
    guests,
    guestsLoading: false,
    addGuest,
    updateGuest,
    removeGuest,
    makeGuestPrimary,
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
    capacity: r.capacity ?? undefined,
  }
}

/** Xona bloki → kalendar bari. Blok bron EMAS (boshqa jadval, mehmonsiz), lekin grid uchun u
    ham "band katak" — shu sabab bir xil shaklga keltiriladi. `id` prefiksi qaysi API'ga
    borishni aytadi. */
function mapBlock(b: RoomBlock): CalendarBooking {
  return {
    id: `${BLOCK_PREFIX}${b.id}`,
    roomId: b.room.id,
    start: b.startDate.slice(0, 10),
    end: b.endDate.slice(0, 10),
    status: "blocked",
    label: defaultLabels.blockKindText[b.kind],
    sublabel: b.reason ?? undefined,
    blockKind: b.kind,
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
    guestCount: b._count?.guests,
    note: b.note,
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
    ...(patch.paidAmount !== undefined ? { paidAmount: patch.paidAmount } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
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

  // Bloklar kamdan-kam o'zgaradi, lekin bandlikning bir qismi — bronlar bilan bir oynada.
  const blocksQ = useQuery({
    queryKey: ["room-blocks", from, to],
    queryFn: () => listRoomBlocks(from, to),
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })

  const rooms = useMemo<CalendarRoom[]>(() => (roomsQ.data ?? []).map(mapRoom), [roomsQ.data])
  const bookings = useMemo<CalendarBooking[]>(
    () => [...(bookingsQ.data ?? []).map(mapBooking), ...(blocksQ.data ?? []).map(mapBlock)],
    [bookingsQ.data, blocksQ.data],
  )

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["bookings"] })
    void qc.invalidateQueries({ queryKey: ["room-blocks"] })
  }, [qc])

  const onError = useCallback(
    (e: unknown, fallback: string) => {
      toast.error(errMessage(e, fallback))
      if (e instanceof ApiError && e.status === 409) invalidate()
    },
    [invalidate],
  )

  // Yagona xona ham shu bulk yo'ldan o'tadi — yaratish kodi bitta bo'lsin. Xato yuqoriga QAYTA
  // otiladi: modal to'la forma (mehmon + xonalar + to'lov) ushlab turadi, muvaffaqiyatsizlikda
  // yopilib ketsa xodim hammasini qaytadan terardi.
  const createBooking = useCallback(
    async (input: CalendarCreateInput) => {
      try {
        if (input.mode === "block") {
          // Blok endpointi bitta xona oladi — bir necha xona tanlansa ketma-ket yuboriladi.
          // Bu ATOMIK EMAS (bronlardan farqli), lekin blokda pul yo'q: yarim qolgan blokni
          // xodim bitta bosish bilan ochadi, shuning uchun tranzaksiya narxi o'zini oqlamaydi.
          for (const roomId of input.roomIds) {
            await createRoomBlock({
              roomId,
              kind: input.kind,
              startDate: input.start,
              endDate: input.end,
              ...(input.reason ? { reason: input.reason } : {}),
            })
          }
          toast.success(input.roomIds.length > 1 ? `${input.roomIds.length} ta xona yopildi` : "Xona yopildi")
          invalidate()
          return
        }

        await apiCreateBookings({
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          checkInDate: input.start,
          checkOutDate: input.end,
          ...(input.guestDocType ? { guestDocType: input.guestDocType as never } : {}),
          ...(input.guestDocNumber ? { guestDocNumber: input.guestDocNumber } : {}),
          ...(input.guests?.length ? { guests: input.guests as GuestInput[] } : {}),
          ...(input.note ? { note: input.note } : {}),
          rooms: input.rooms.map((r) => ({
            roomId: r.roomId,
            totalAmount: r.totalAmount,
            paidAmount: r.paidAmount,
          })),
        })
        toast.success(input.rooms.length > 1 ? `${input.rooms.length} ta bron yaratildi` : "Bron yaratildi")
        invalidate()
      } catch (e) {
        // 409 = oradan boshqa xodim ulgurdi. Kalendarni darrov yangilaymiz, xodim kim band
        // qilganini ko'rib boshqa xona tanlasin (modal ochiq qoladi).
        if (e instanceof ApiError && e.status === 409) {
          toast.error("Xona tanlangan sanalarda band — kalendar yangilandi")
          invalidate()
        } else {
          onError(e, "Bron yaratilmadi")
        }
        throw e
      }
    },
    [invalidate, onError],
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

  const removeBlock = useCallback(
    async (id: string) => {
      try {
        await removeRoomBlock(isBlockId(id) ? blockIdOf(id) : id)
        toast.success("Xona ochildi")
        invalidate()
      } catch (e) {
        onError(e, "Xona ochilmadi")
      }
    },
    [invalidate, onError],
  )

  // ── Tanlangan bronning mehmonlari ────────────────────────────────────────
  // Ro'yxat so'rovi faqat SONNI beradi (200 bron × qatorlar oynani sekinlashtirardi), to'liq
  // ro'yxat modal ochilganda shu query bilan keladi. Blok tanlansa umuman so'ralmaydi.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const guestsQ = useQuery({
    queryKey: ["booking-guests", selectedId],
    queryFn: () => getBooking(selectedId as string),
    enabled: enabled && selectedId != null && !isBlockId(selectedId),
    staleTime: 30_000,
  })
  const guests = guestsQ.data?.guests ?? null

  const refreshGuests = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["booking-guests"] })
    // Bar'dagi mehmon soni va asosiy mehmon ismi ham o'zgargan bo'lishi mumkin.
    void qc.invalidateQueries({ queryKey: ["bookings"] })
  }, [qc])

  /** Mehmon amallari bir xil qolipda: bajarish → xabar → ikkala keshni yangilash. */
  const guestAction = useCallback(
    async (run: () => Promise<unknown>, ok: string, fail: string) => {
      try {
        await run()
        toast.success(ok)
        refreshGuests()
      } catch (e) {
        onError(e, fail)
      }
    },
    [refreshGuests, onError],
  )

  const addGuest = useCallback(
    (bookingId: string, guest: LooseGuestInput) =>
      guestAction(
        () => addBookingGuest(bookingId, toGuestInput(guest)),
        "Mehmon qo'shildi",
        "Mehmon qo'shilmadi",
      ),
    [guestAction],
  )
  const updateGuest = useCallback(
    (bookingId: string, guestId: string, patch: Partial<LooseGuestInput>) =>
      guestAction(
        () => updateBookingGuest(bookingId, guestId, toGuestPatch(patch)),
        "Saqlandi",
        "Saqlanmadi",
      ),
    [guestAction],
  )
  const removeGuest = useCallback(
    (bookingId: string, guestId: string) =>
      guestAction(() => removeBookingGuest(bookingId, guestId), "Mehmon o'chirildi", "O'chirilmadi"),
    [guestAction],
  )
  const makeGuestPrimary = useCallback(
    (bookingId: string, guestId: string) =>
      guestAction(() => apiSetPrimaryGuest(bookingId, guestId), "Asosiy mehmon almashdi", "Almashtirilmadi"),
    [guestAction],
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
    removeBlock,
    selectGuestsFor: setSelectedId,
    guests,
    guestsLoading: guestsQ.isLoading,
    addGuest,
    updateGuest,
    removeGuest,
    makeGuestPrimary,
  }
}
