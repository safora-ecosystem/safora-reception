import { useCallback, useEffect, useMemo, useState } from "react"
import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { t } from "@/lib/i18n"
import {
  addDays,
  calendarLabels,
  epochDay,
  generateMockData,
  type BookingEditPatch,
  type CalendarActivityEntry,
  type CalendarBooking,
  type CalendarCreateInput,
  nightsBetween,
  type CalendarDraft,
  type CalendarOrganization,
  type CalendarPaymentEntry,
  type CalendarRange,
  type CalendarRoom,
  type CalendarSplitInput,
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
  getBookingActivity,
  listBookings,
  listOrganizations,
  listRoomBlocks,
  listRooms,
  recordBookingPayment,
  removeBookingGuest,
  removeRoomBlock,
  moveBookingNext as apiMoveBookingNext,
  setPrimaryGuest as apiSetPrimaryGuest,
  splitBooking as apiSplitBooking,
  shiftKeys,
  updateBooking as apiUpdateBooking,
  updateBookingGuest,
  voidBookingPayment,
  type Booking,
  type BookingGuest,
  type BookingPayment,
  type GuestInput,
  type Organization,
  type Room,
  type RoomBlock,
  type UpdateBookingBody,
} from "@/lib/api"
import { getSession } from "@/lib/auth"
import { localIso } from "@/lib/format"
import { keys } from "@/lib/query-keys"

const BLOCK_PREFIX = "block:"
export const isBlockId = (id: string) => id.startsWith(BLOCK_PREFIX)
export const blockIdOf = (id: string) => id.slice(BLOCK_PREFIX.length)


export interface CalendarData {
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  organizations: CalendarOrganization[]
  roomlessCount: number
  isLoading: boolean
  error: unknown
  retry: () => Promise<unknown> | void
  createBooking: (input: CalendarCreateInput) => Promise<void>
  checkIn: (id: string) => Promise<void>
  checkOut: (id: string) => Promise<void>
  cancel: (id: string, reason?: string) => Promise<void>
  editBooking: (id: string, patch: BookingEditPatch) => Promise<void>
  moveBooking: (id: string, next: CalendarDraft) => Promise<void>
  splitBooking: (id: string, input: CalendarSplitInput) => Promise<void>
  moveNext: (id: string) => Promise<void>
  removeBlock: (id: string) => Promise<void>

  selectGuestsFor: (bookingId: string | null) => void
  guests: BookingGuest[] | null
  guestsLoading: boolean
  addGuest: (bookingId: string, guest: LooseGuestInput) => Promise<void>
  updateGuest: (bookingId: string, guestId: string, patch: Partial<LooseGuestInput>) => Promise<void>
  removeGuest: (bookingId: string, guestId: string) => Promise<void>
  makeGuestPrimary: (bookingId: string, guestId: string) => Promise<void>

  payments: CalendarPaymentEntry[] | null
  recordPayment?: (
    bookingId: string,
    input: { amount: number; method: "cash" | "card" | "transfer"; note?: string; eventId: string },
  ) => Promise<void>
  voidPayment?: (
    bookingId: string,
    paymentId: string,
    input: { reason: string; cashReturned?: boolean },
  ) => Promise<void>
  activity: CalendarActivityEntry[] | null
  activityLoading: boolean
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

const noop = () => {}

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
          label: calendarLabels().blockKindText[input.kind],
          sublabel: input.reason,
          blockKind: input.kind,
          createdAt,
        })),
      ])
      return
    }
    setBookings((prev) => [
      ...prev,
      // Xona o'z mehmoniga ega bo'lsa (joylashtirish ro'yxati) uniki ustun — real adapter ham
      // shunday qiladi, ya'ni mock va real bir xil qoidada qoladi.
      ...input.rooms.map((r) => ({
        id: `bk-new-${mockIdSeq++}`,
        roomId: r.roomId,
        start: input.start,
        end: input.end,
        status: "booked" as const,
        label: r.guestName ?? input.guestName ?? "",
        sublabel: r.guestPhone ?? input.guestPhone,
        payment: { total: r.totalAmount, paid: r.paidAmount },
        guestConfirmed: false,
        guestCount: 1 + ((r.guestName ? r.guests : input.guests)?.length ?? 0),
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
        ...(patch.totalAmount !== undefined
          ? {
              payment: {
                total: patch.totalAmount,
                paid: b.payment?.paid ?? 0,
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

  // Mock rejimida bo'lish REAL serverning natijasini takrorlaydi: birinchi qism qisqaradi,
  // ikkinchisi yangi xonada paydo bo'ladi, ikkalasi bir xil `linkId` oladi — kalendar uzuq
  // chiziqli izni aynan shundan chizadi. Har qism O'Z narxida (yig'indi o'zgarishi mumkin) va
  // PUL KO'CHIRILMAYDI — u qaysi bo'lakda olingan bo'lsa o'sha yerda qoladi.
  //
  // ⚠️ Mock `folio` BERMAYDI (zanjir hisobini server hisoblaydi) — ya'ni offline rejimda pul
  // bo'lakma-bo'lak ko'rinadi. Bu mock chegarasi, mahsulot xulqi emas.
  const splitBooking = useCallback(
    async (id: string, input: CalendarSplitInput) =>
      setBookings((prev) => {
        const b = prev.find((x) => x.id === id)
        if (!b) return prev
        const linkId = b.linkId ?? `link-${mockIdSeq++}`
        const total = b.payment?.total ?? 0
        const nights = nightsBetween(b.start, b.end)
        const firstNights = nightsBetween(b.start, input.splitDate)
        const secondNights = nightsBetween(input.splitDate, b.end)
        const firstTotal =
          input.firstTotalAmount ?? (nights > 0 ? Math.round((total * firstNights) / nights) : 0)
        const secondTotal =
          input.totalAmount ?? (nights > 0 ? Math.round((total * secondNights) / nights) : 0)
        const moved = input.moveNow === true && b.status === "checked_in"
        return [
          ...prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  end: input.splitDate,
                  linkId,
                  ...(moved ? { status: "checked_out" as const } : {}),
                  ...(x.payment ? { payment: { ...x.payment, total: firstTotal } } : {}),
                }
              : x,
          ),
          {
            ...b,
            id: `bk-split-${mockIdSeq++}`,
            roomId: input.roomId,
            start: input.splitDate,
            end: b.end,
            status: moved ? ("checked_in" as const) : ("booked" as const),
            linkId,
            checkedInAt: null,
            checkedOutAt: null,
            ...(b.payment ? { payment: { total: secondTotal, paid: 0 } } : {}),
          },
        ]
      }),
    [],
  )

  // Ko'chirishni yakunlash — mehmon turgan bo'lak chiqadi, keyingisi kiradi.
  const moveNext = useCallback(
    async (id: string) =>
      setBookings((prev) => {
        const from = prev.find((x) => x.id === id)
        if (!from?.linkId) return prev
        const next = prev
          .filter((x) => x.linkId === from.linkId && x.id !== id && x.start >= from.end)
          .sort((a, c) => (a.start < c.start ? -1 : 1))[0]
        if (!next) return prev
        return prev.map((x) =>
          x.id === from.id
            ? { ...x, status: "checked_out" as const }
            : x.id === next.id
              ? { ...x, status: "checked_in" as const }
              : x,
        )
      }),
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
    // Mock rejimida shartnomali mijoz yo'q — korporativ rejim ko'rinmaydi.
    organizations: [],
    roomlessCount: 0,
    isLoading: false,
    error: null,
    retry: noop,
    createBooking,
    checkIn,
    checkOut,
    cancel,
    editBooking,
    moveBooking,
    splitBooking,
    moveNext,
    removeBlock,
    selectGuestsFor: setSelectedId,
    guests,
    guestsLoading: false,
    addGuest,
    updateGuest,
    removeGuest,
    makeGuestPrimary,
    // Mock'da ledger/tarix yo'q — modal eski yig'ma to'lov kartasi + statik timeline'ga tushadi.
    payments: null,
    activity: null,
    activityLoading: false,
  }
}

// ── Real core-api adapteri ────────────────────────────────────────────────────

function mapRoom(r: Room): CalendarRoom {
  return {
    id: r.id,
    label: r.number,
    group: r.floor != null ? t("rooms.floorNo", { floor: r.floor }) : undefined,
    sublabel: r.type || undefined,
    order: Number.parseInt(r.number, 10) || undefined,
    rate: r.rate != null ? Number(r.rate) : undefined,
    capacity: r.capacity ?? undefined,
    housekeeping: r.housekeepingStatus,
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
    label: calendarLabels().blockKindText[b.kind],
    sublabel: b.reason ?? undefined,
    blockKind: b.kind,
  }
}

function mapBooking(b: Booking): CalendarBooking {
  const total = b.totalAmount != null ? Number(b.totalAmount) : undefined
  return {
    id: b.id,
    // `!` xavfsiz: chaqiruvchi xonasiz bronlarni filtrlaydi (ular gridda chizilmaydi,
    // soni `roomlessCount` bilan sahifaga chiqadi) — 2026-08-08 dagi birinchi bot broni
    // shu yerda butun kalendarni yiqitgan edi.
    roomId: b.room!.id,
    start: b.checkInDate.slice(0, 10),
    end: b.checkOutDate.slice(0, 10),
    status: b.status,
    label: b.guestName,
    // `sublabel` — MEHMONNING TELEFONI, korporativda ham. Bir vaqtlar bu yerda kompaniya nomi
    // qo'yilgan edi va detal oynasidagi "Telefon" maydonida tashkilot nomi chiqib qolgan edi:
    // yadro uchun `sublabel` bitta ma'noga ega bo'lishi kerak. Korporativ belgisi alohida
    // maydondan (`organization`) o'qiladi — bar, tooltip va detal uni shundan chizadi.
    sublabel: b.guestPhone ?? undefined,
    // `payment` — SHU bronning O'Z puli va shundayligicha qoladi: bo'lish oynasi summani
    // aynan shundan taqsimlaydi. Butun yashashning puli alohida (`folio`) va ekranga
    // qaysi biri chiqishini `calendar/folio.ts` hal qiladi.
    payment: total != null ? { total, paid: Number(b.paidAmount ?? 0) } : undefined,
    folio: b.folio,
    guestConfirmed: b.guestConfirmed,
    checkedInAt: b.checkedInAt,
    checkedOutAt: b.checkedOutAt,
    createdAt: b.createdAt,
    guestCount: b._count?.guests,
    note: b.note,
    linkId: b.linkId,
    organization: b.organization
      ? { id: b.organization.id, name: b.organization.name, shortName: b.organization.shortName }
      : null,
    orgRef: b.orgRef,
    // Kim ochgani + qaysi kanaldan. Ikkalasi ham ixtiyoriy: eski bronlarda `createdBy` yo'q,
    // `source` esa backend enum'i (sukut — `reception`).
    createdBy: b.createdBy ? { name: b.createdBy.name, role: b.createdBy.role } : null,
    source: b.source,
  }
}

/** Shartnoma qatorini yadro shakliga. Decimal'lar string bo'lib keladi — raqamga aylantiriladi. */
function mapOrganization(o: Organization): CalendarOrganization {
  return {
    id: o.id,
    name: o.name,
    shortName: o.shortName,
    contractNumber: o.contractNumber,
    inn: o.inn,
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    discountPercent: o.discountPercent != null ? Number(o.discountPercent) : null,
    creditLimit: o.creditLimit != null ? Number(o.creditLimit) : null,
    paymentTermDays: o.paymentTermDays,
    balance: o.balance,
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
    // paidAmount ATAYLAB yo'q: legacy adjustment-eshigi panel tomondan yopilgan
    // (BookingEditPatch'dagi izoh).
    ...(patch.note !== undefined ? { note: patch.note } : {}),
  }
}

// ── Bo'lak-bo'lak (batch) yuklash ─────────────────────────────────────────────
//
// Kalendar diapazoni ~600 kun. Ilgari bu BITTA `GET /bookings?from&to` bilan olinardi va har 30
// soniyada BUTUNLIGICHA qayta tortilardi: birinchi chizishgacha butun 20 oylik javob kutilardi
// (parse + geometriya ham bir zumda), poll esa har safar o'sha yukni qaytarardi.
//
// Endi diapazon 90 kunlik bo'laklarga bo'linadi. Bugungi bo'lak BIRINCHI ketadi — kalendar darrov
// chiziladi; qolganlari BIRMA-BIR, yaqindan uzoqqa (parallel EMAS — 7 ta bir vaqtdagi so'rov
// API'ni bekorga urardi, foydalanuvchi esa baribir faqat birinchi ekranni ko'radi).
//
// Chegaradagi bron ikkala qo'shni bo'lakda ham keladi — server `from/to` ni KESISHMA bo'yicha
// filtrlaydi (`checkOut >= from && checkIn <= to`), ya'ni bo'lakni butunlay qamrab o'tgan uzun
// bron HAR bo'lakda chiqadi. Shu sabab birlashtirishda `id` bo'yicha dedupe SHART: aks holda bir
// bron ikki marta chizilardi va overlap hisobi ham buzilardi.
const CHUNK_DAYS = 90

interface BookingChunk {
  from: string
  to: string
  /** Bugun shu bo'lakda — resepshnning jonli ishi shu yerda, tez-tez poll faqat shunga. */
  hot: boolean
}

/** Diapazonni bo'laklarga bo'ladi va YUKLASH TARTIBIDA qaytaradi: bugungisi, keyin oldinga, keyin orqaga. */
function bookingChunks(range: CalendarRange, today: string): BookingChunk[] {
  const count = Math.max(1, Math.ceil(range.days / CHUNK_DAYS))
  const todayOffset = epochDay(today) - epochDay(range.start)
  // Bugun diapazondan tashqarida bo'lsa (masalan tarixga qaralayotgan bo'lsa) eng yaqin chekkaga tushadi.
  const hotIdx = Math.min(count - 1, Math.max(0, Math.floor(todayOffset / CHUNK_DAYS)))
  const order = [hotIdx]
  for (let i = hotIdx + 1; i < count; i++) order.push(i)
  for (let i = hotIdx - 1; i >= 0; i--) order.push(i)
  return order.map((i) => ({
    from: addDays(range.start, i * CHUNK_DAYS),
    to: addDays(range.start, Math.min((i + 1) * CHUNK_DAYS, range.days)),
    hot: i === hotIdx,
  }))
}

/**
 * Bo'laklarni bitta natijaga yig'adi. MODUL DARAJASIDA (barqaror ref) bo'lishi SHART — `useQueries`
 * combine'ni faqat funksiya identikligi va natijalar o'zgarganda qayta hisoblaydi va javobga
 * `replaceEqualDeep` qo'llaydi, ya'ni kontent o'zgarmasa `rows` REFERENSI ham o'zgarmaydi. Beqaror
 * combine bo'lsa har render'da yangi massiv chiqib, `useBookingIndex` butun geometriyani qayta
 * hisoblardi (CALENDAR.md perf shartnomasi #1).
 */
function combineBookingChunks(results: UseQueryResult<Booking[], Error>[]) {
  return {
    rows: results.flatMap((r) => r.data ?? []),
    /** Javobi kelgan (yoki xato bergan) bo'laklar soni — keyingisini ochish signali. */
    settled: results.reduce((n, r) => n + (r.isSuccess || r.isError ? 1 : 0), 0),
    /** Faqat BIRINCHI (bugungi) bo'lak kalendarni "yuklanmoqda" holatida ushlaydi. */
    isLoading: results[0]?.isLoading ?? false,
    error: results[0]?.error ?? null,
    /** Birinchi bo'lakning ko'rsatsa bo'ladigan javobi bormi. Xato + eski data = kalendar
        ochiq qoladi (poll yiqildi xolos); xato + data yo'q = haqiqiy "yuklanmadi" holati. */
    firstHasData: results[0] ? results[0].data !== undefined : false,
  }
}

function errMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return t("calendarToast.stale")
    const body = e.body as { message?: unknown } | null
    if (body && typeof body.message === "string") return body.message
  }
  return fallback
}

// ── Toraytirilgan invalidatsiya ───────────────────────────────────────────────
//
// Ilgari HAR mutatsiya to'rt prefiksni butunlay supurardi (`["bookings"]` prefiksi = 600
// kunlik ~7 bo'lak + statistika oynasi + bugungi taxta) — bitta check-in butun panel bo'ylab
// refetch portlashi degani edi. Endi mutatsiya o'z bronining [from,to] oralig'ini aytadi va
// faqat shu oraliq bilan KESISHGAN bo'laklar qayta so'raladi; mehmon/tarix keshlari esa faqat
// tegilgan bron uchun. Qamrov berilmagan yo'llar (409 dagi "nima o'zgarganini bilmaymiz")
// avvalgidek keng qoladi.
//
// Qaytish yo'li — BITTA qator: `false` qilinsa eski (keng) xulq to'liq tiklanadi.
const NARROW_INVALIDATION: boolean = true

/** Mutatsiya qamrovi: bron sanalari + (ma'lum bo'lsa) bron id'si. `undefined` = keng yo'l. */
type InvalidateScope = { from: string; to: string; bookingId?: string }

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** `["bookings"|"room-blocks", from, to]` kalitlari uchun predikat: faqat qamrov bilan
    kesishgan bo'laklar qoladi (server filtri bilan bir xil inclusive kesishma). Shakli
    NOMA'LUM kalit (masalan rooms-page'dagi `["bookings", "today", …]`) `true` oladi —
    keng yo'lda qoladi, ya'ni yangi kalit shakli hech qachon jimgina eskirib qolmaydi. */
function overlapsScope(scope: InvalidateScope) {
  return (q: { queryKey: readonly unknown[] }): boolean => {
    const from = q.queryKey[1]
    const to = q.queryKey[2]
    if (typeof from !== "string" || typeof to !== "string" || !ISO_DAY.test(from) || !ISO_DAY.test(to)) {
      return true
    }
    return from <= scope.to && to >= scope.from
  }
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
  const roomsQ = useQuery({ queryKey: keys.rooms(), queryFn: listRooms, enabled, staleTime: 5 * 60_000 })

  // Shartnomali mijozlar — xonalar kabi kamdan-kam o'zgaradi. Yiqilsa (masalan `organizations.view`
  // ruxsati yo'q) kalendar BUZILMAYDI: ro'yxat bo'sh qoladi va korporativ rejim ko'rinmaydi.
  // Shu sabab bu so'rov `error` hisobiga ham kirmaydi — u kalendarning yashash sharti emas.
  const orgsQ = useQuery({
    queryKey: keys.organizations(),
    // O'ralgan chaqiruv: `listOrganizations` ni TO'G'RIDAN-TO'G'RI berish mumkin emas —
    // TanStack queryFn'ga kontekst obyektini uzatadi va u panellarda ixtiyoriy filtr
    // argumenti bo'lib tushib qolardi (owner panelida `listOrganizations(params?)`).
    queryFn: () => listOrganizations(),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const organizations = useMemo<CalendarOrganization[]>(
    () => (orgsQ.data ?? []).map(mapOrganization),
    [orgsQ.data],
  )

  // Bronlar — 90 kunlik bo'laklar (yuqoridagi izohga qara). `range` container'da bir marta
  // memo qilinadi, shuning uchun bo'laklar ro'yxati ham mount davomida barqaror.
  const chunks = useMemo(() => bookingChunks(range, localIso()), [range])
  const [openCount, setOpenCount] = useState(1)
  const bookingsQ = useQueries({
    queries: chunks.map((c, i) => ({
      queryKey: keys.bookings(c.from, c.to),
      queryFn: () => listBookings(c.from, c.to),
      enabled: enabled && i < openCount,
      // Bugungi bo'lak — UMUMIY ish stoli: bir necha resepshn xodimi bir vaqtda bron ochadi/kirish
      // belgilaydi, shuning uchun global `refetchOnWindowFocus: false` ATAYLAB bekor qilinadi va
      // 30s poll saqlanadi (ilgari butun 600 kun shu tezlikda qayta tortilardi). Uzoq oylarda bron
      // kamdan-kam ochiladi → 5 daqiqa yetarli, `staleTime` esa fokusdagi so'rov portlashini
      // bo'g'adi. Mutatsiya faqat O'Z oralig'i bilan kesishgan bo'laklarni invalidate qiladi
      // (pastdagi `invalidate` + `overlapsScope`), qamrovsiz yo'llar esa keng supuradi.
      // Fon tab'da poll to'xtaydi (refetchIntervalInBackground default false).
      refetchOnWindowFocus: true,
      refetchInterval: c.hot ? 30_000 : 5 * 60_000,
      staleTime: c.hot ? 0 : 60_000,
      // Yarim tunda `today` o'tib bo'lak kalitlari yangilansa ham kalendar BO'SHAB QOLMAYDI:
      // eski oynaning javobi yangi so'rov kelguncha ekranda turadi.
      placeholderData: keepPreviousData,
    })),
    combine: combineBookingChunks,
  })

  // Progressiv ochilish: joriy bo'laklar javob bergach keyingisi ochiladi — ketma-ket, bittadan.
  useEffect(() => {
    if (!enabled || openCount >= chunks.length) return
    if (bookingsQ.settled >= openCount) setOpenCount((n) => n + 1)
  }, [enabled, openCount, chunks.length, bookingsQ.settled])

  // Bloklar kamdan-kam o'zgaradi, lekin bandlikning bir qismi — bronlar bilan bir oynada.
  const blocksQ = useQuery({
    queryKey: keys.roomBlocks(from, to),
    queryFn: () => listRoomBlocks(from, to),
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })

  const rooms = useMemo<CalendarRoom[]>(() => (roomsQ.data ?? []).map(mapRoom), [roomsQ.data])
  const bookings = useMemo<CalendarBooking[]>(() => {
    const seen = new Set<string>()
    const out: CalendarBooking[] = []
    for (const b of bookingsQ.rows) {
      if (seen.has(b.id)) continue // bo'lak chegarasidagi (yoki bo'lakni qamrab o'tgan) bron takrorlanadi
      seen.add(b.id)
      // Bot/kanal broni xona tayinlanguncha xonasiz keladi — gridda chizib bo'lmaydi
      // (qaysi qatorga?), lekin YO'QOTIB ham bo'lmaydi: soni bannerda ko'rinadi.
      if (!b.room) continue
      out.push(mapBooking(b))
    }
    for (const bl of blocksQ.data ?? []) out.push(mapBlock(bl))
    return out
  }, [bookingsQ.rows, blocksQ.data])

  const roomlessCount = useMemo(() => {
    const seen = new Set<string>()
    for (const b of bookingsQ.rows) {
      if (!b.room && b.status !== "cancelled" && b.status !== "checked_out") seen.add(b.id)
    }
    return seen.size
  }, [bookingsQ.rows])

  /** Keshni yangilash. `scope` berilsa faqat bron oralig'i bilan kesishgan bo'laklar qayta
      so'raladi; berilmasa — keng yo'l ("nima o'zgarganini bilmaymiz": 409 va topilmagan qator). */
  const invalidate = useCallback(
    (scope?: InvalidateScope) => {
      if (!NARROW_INVALIDATION || !scope) {
        void qc.invalidateQueries({ queryKey: keys.bookingsAll })
        void qc.invalidateQueries({ queryKey: keys.roomBlocksAll })
        // Har mutatsiya faoliyat logiga yozadi, tahrir esa ledger'ga ham (adjustment) —
        // ochiq modal eski tarix/to'lovlarni ko'rsatib qolmasin.
        void qc.invalidateQueries({ queryKey: keys.bookingGuestsAll })
        void qc.invalidateQueries({ queryKey: keys.bookingActivityAll })
        return
      }
      const overlaps = overlapsScope(scope)
      void qc.invalidateQueries({ queryKey: keys.bookingsAll, predicate: overlaps })
      void qc.invalidateQueries({ queryKey: keys.roomBlocksAll, predicate: overlaps })
      // Mehmon/tarix keshi bron id bo'yicha; id NOMA'LUM bo'lsa (yangi bron, blok, zanjir)
      // keng supuriladi — bu ikkalasi faqat ochiq modal uchun yuklanadi, ya'ni arzon.
      if (scope.bookingId != null) {
        void qc.invalidateQueries({ queryKey: keys.bookingGuests(scope.bookingId) })
        void qc.invalidateQueries({ queryKey: keys.bookingActivity(scope.bookingId) })
      } else {
        void qc.invalidateQueries({ queryKey: keys.bookingGuestsAll })
        void qc.invalidateQueries({ queryKey: keys.bookingActivityAll })
      }
    },
    [qc],
  )

  /** Mutatsiya qamrovi keshdagi qatordan olinadi — topilmasa `undefined` (keng yo'l qoladi). */
  const scopeOf = useCallback(
    (id: string): InvalidateScope | undefined => {
      const b = bookingsQ.rows.find((x) => x.id === id)
      return b
        ? { from: b.checkInDate.slice(0, 10), to: b.checkOutDate.slice(0, 10), bookingId: id }
        : undefined
    },
    [bookingsQ.rows],
  )

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
      // Yangi yozuvning id'si hali yo'q — qamrov faqat sanalardan.
      const scope: InvalidateScope = { from: input.start, to: input.end }
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
          toast.success(input.roomIds.length > 1 ? t("calendarToast.roomsBlocked", { count: input.roomIds.length }) : t("calendarToast.roomBlocked"))
          invalidate(scope)
          return
        }

        await apiCreateBookings({
          ...(input.guestName ? { guestName: input.guestName } : {}),
          ...(input.guestPhone ? { guestPhone: input.guestPhone } : {}),
          checkInDate: input.start,
          checkOutDate: input.end,
          ...(input.guestDocType ? { guestDocType: input.guestDocType as never } : {}),
          ...(input.guestDocNumber ? { guestDocNumber: input.guestDocNumber } : {}),
          ...(input.guests?.length ? { guests: input.guests as GuestInput[] } : {}),
          ...(input.note ? { note: input.note } : {}),
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
          ...(input.orgRef ? { orgRef: input.orgRef } : {}),
          ...(input.method ? { method: input.method } : {}),
          // Joylashtirish ro'yxati bo'lsa har xona o'z mehmoni bilan ketadi (korporativ oqim);
          // bo'lmasa faqat summa uzatiladi va umumiy mehmon hamma xonaga nusxalanadi.
          rooms: input.rooms.map((r) => ({
            roomId: r.roomId,
            totalAmount: r.totalAmount,
            paidAmount: r.paidAmount,
            ...(r.eventId ? { eventId: r.eventId } : {}),
            ...(r.guestName ? { guestName: r.guestName } : {}),
            ...(r.guestPhone ? { guestPhone: r.guestPhone } : {}),
            ...(r.guestDocType ? { guestDocType: r.guestDocType as never } : {}),
            ...(r.guestDocNumber ? { guestDocNumber: r.guestDocNumber } : {}),
            ...(r.guests?.length ? { guests: r.guests as GuestInput[] } : {}),
          })),
        })
        toast.success(input.rooms.length > 1 ? `${input.rooms.length} ta bron yaratildi` : t("calendarToast.created"))
        invalidate(scope)
      } catch (e) {
        // 409 = oradan boshqa xodim ulgurdi. Kalendarni darrov yangilaymiz, xodim kim band
        // qilganini ko'rib boshqa xona tanlasin (modal ochiq qoladi).
        if (e instanceof ApiError && e.status === 409) {
          toast.error(t("calendarToast.conflict"))
          invalidate(scope)
        } else {
          onError(e, t("calendarToast.createFailed"))
        }
        throw e
      }
    },
    [invalidate, onError],
  )

  const checkIn = useCallback(
    async (id: string) => {
      const scope = scopeOf(id)
      try {
        await checkInBooking(id)
        toast.success(t("calendarToast.checkedIn"))
        invalidate(scope)
      } catch (e) {
        onError(e, t("calendarToast.checkInFailed"))
      }
    },
    [invalidate, onError, scopeOf],
  )

  const checkOut = useCallback(
    async (id: string) => {
      const scope = scopeOf(id)
      try {
        await checkOutBooking(id)
        toast.success(t("calendarToast.checkedOut"))
        invalidate(scope)
      } catch (e) {
        onError(e, t("calendarToast.checkOutFailed"))
      }
    },
    [invalidate, onError, scopeOf],
  )

  const cancel = useCallback(
    async (id: string, reason?: string, payments?: "keep" | "purge") => {
      const scope = scopeOf(id)
      try {
        await cancelBooking(id, { reason, payments })
        toast.success(t("calendarToast.cancelled"))
        invalidate(scope)
      } catch (e) {
        onError(e, t("calendarToast.cancelFailed"))
      }
    },
    [invalidate, onError, scopeOf],
  )

  const editBooking = useCallback(
    async (id: string, patch: BookingEditPatch) => {
      const body = toUpdateBody(patch)
      if (Object.keys(body).length === 0) return // hech narsa o'zgarmagan — so'rov yubormaymiz
      // Qamrov — ESKI va YANGI oraliqning birlashmasi: bar qisqarganda bo'shagan bo'lak ham
      // undan tozalanishi kerak.
      const prev = scopeOf(id)
      const scope: InvalidateScope | undefined = prev && {
        from: patch.start !== undefined && patch.start < prev.from ? patch.start : prev.from,
        to: patch.end !== undefined && patch.end > prev.to ? patch.end : prev.to,
        bookingId: id,
      }
      try {
        await apiUpdateBooking(id, body)
        toast.success(t("calendarToast.updated"))
        invalidate(scope)
      } catch (e) {
        onError(e, t("calendarToast.updateFailed"))
      }
    },
    [invalidate, onError, scopeOf],
  )

  const moveBooking = useCallback(
    async (id: string, next: CalendarDraft) => {
      // Sudrashdan OLDINGI holat — t("calendarToast.undo") shu joyga qaytaradi. Tasodifiy drag front-deskda
      // tez-tez bo'ladi (umumiy sichqonchali stol); tasdiqlash oynasi har ko'chirishni
      // sekinlashtirgan bo'lardi, undo esa faqat xatoni to'g'irlaydi.
      const prev = bookingsQ.rows.find((b) => b.id === id)
      // Qamrov — eski va yangi joyning birlashmasi: undo ham shu oraliq ichida qoladi.
      const prevRange = prev
        ? { from: prev.checkInDate.slice(0, 10), to: prev.checkOutDate.slice(0, 10) }
        : null
      const scope: InvalidateScope | undefined = prevRange
        ? {
            from: next.start < prevRange.from ? next.start : prevRange.from,
            to: next.end > prevRange.to ? next.end : prevRange.to,
            bookingId: id,
          }
        : undefined
      // OPTIMISTIK: bar YANGI katakka darhol o'tadi — sekin tarmoqda server javobini kutish
      // "drag ishlamadi" bo'lib tuyulardi (prod audit, 2026-08-01). Avval in-flight so'rovlar
      // bekor qilinadi (parallel poll eski holatni ustidan yozib "sakrab qaytish" ko'rsatmasin),
      // snapshot esa XATODA aynan qaytariladi — offline'da ham rollback ishlaydi (invalidate
      // yolg'iz yetmasdi: refetch ham yiqilsa optimistik holat ekranda qolib ketardi).
      await qc.cancelQueries({ queryKey: keys.bookingsAll })
      const snapshots = qc.getQueriesData<Booking[]>({ queryKey: keys.bookingsAll })
      const nextRoom = (qc.getQueryData<Room[]>(keys.rooms()) ?? []).find((r) => r.id === next.roomId)
      qc.setQueriesData<Booking[]>({ queryKey: keys.bookingsAll }, (rows) =>
        rows?.map((b) =>
          b.id === id
            ? {
                ...b,
                checkInDate: next.start,
                checkOutDate: next.end,
                ...(nextRoom ? { room: { ...b.room, id: nextRoom.id, number: nextRoom.number } } : {}),
              }
            : b,
        ),
      )
      try {
        await apiUpdateBooking(id, {
          roomId: next.roomId,
          checkInDate: next.start,
          checkOutDate: next.end,
        })
        invalidate(scope)
        toast.success(t("calendarToast.moved"), {
          action: prev
            ? {
                label: t("calendarToast.undo"),
                onClick: () => {
                  apiUpdateBooking(id, {
                    // `!` xavfsiz: move faqat griddagi (xonali) bar ustida ishlaydi.
                    roomId: prev.room!.id,
                    checkInDate: prev.checkInDate.slice(0, 10),
                    checkOutDate: prev.checkOutDate.slice(0, 10),
                  })
                    .then(() => {
                      toast.success(t("calendarToast.restored"))
                      invalidate(scope) // birlashma qaytishni ham qamraydi
                    })
                    // Eski katakni oradan boshqa xodim band qilgan bo'lishi mumkin (409).
                    .catch((e) => onError(e, t("calendarToast.restoreFailed")))
                },
              }
            : undefined,
        })
      } catch (e) {
        // Rollback: optimistik yozuvlar snapshot'dan sinxron qaytadi (tarmoqsiz ham ishlaydi);
        // 409 bo'lsa onError o'zi invalidate qilib server haqiqatini ham tortadi.
        for (const [key, data] of snapshots) qc.setQueryData(key, data)
        onError(e, t("calendarToast.moveFailed"))
      }
    },
    [bookingsQ.rows, qc, invalidate, onError],
  )

  // Bo'lish serverda BITTA tranzaksiya: birinchi qism qisqaradi, ikkinchisi yangi xonada
  // ochiladi, ikkalasi bir xil `link_id` oladi. Yangi xona band bo'lsa 409 qaytadi va DB'da
  // hech narsa o'zgarmaydi — shu sabab bu yerda "yarim bo'lingan" holatni tozalash kodi yo'q.
  const splitBooking = useCallback(
    async (id: string, input: CalendarSplitInput) => {
      // Ikkala bo'lak ham asl oraliq ICHIDA qoladi — qamrovga asl bron yetadi.
      const scope = scopeOf(id)
      try {
        await apiSplitBooking(id, {
          splitDate: input.splitDate,
          roomId: input.roomId,
          ...(input.totalAmount !== undefined ? { totalAmount: input.totalAmount } : {}),
          ...(input.firstTotalAmount !== undefined
            ? { firstTotalAmount: input.firstTotalAmount }
            : {}),
          ...(input.moveNow ? { moveNow: true } : {}),
        })
        toast.success(t("calendarToast.splitDone"))
        invalidate(scope)
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          toast.error(t("calendarToast.splitBusy"))
          invalidate(scope)
        } else {
          onError(e, t("calendarToast.splitFailed"))
        }
        // Oyna ochiq qolsin: xodim boshqa xona yoki sana tanlab qayta urinsin.
        throw e
      }
    },
    [invalidate, onError, scopeOf],
  )

  // KO'CHIRISHNI YAKUNLASH — chiqarish + kiritish serverda BITTA tranzaksiya, shuning uchun
  // bu yerda "yarim ko'chgan" holatni tozalash kodi yo'q. 409 — xona band yoki bo'lak
  // kirishga tayyor emas: server sababni o'zi yozadi, uni shundayligicha ko'rsatamiz.
  const moveNext = useCallback(
    async (id: string) => {
      // Qamrov — bo'lak ZANJIRI birlashmasi: chiqarish+kiritish ikki bo'lakni o'zgartiradi,
      // keyingi bo'lak id'sini esa server tanlaydi — shu sabab `bookingId` ATAYLAB berilmaydi
      // (mehmon/tarix keshi keng yangilanadi).
      const b = bookingsQ.rows.find((x) => x.id === id)
      let scope: InvalidateScope | undefined
      if (b) {
        scope = { from: b.checkInDate.slice(0, 10), to: b.checkOutDate.slice(0, 10) }
        if (b.linkId) {
          for (const x of bookingsQ.rows) {
            if (x.linkId !== b.linkId) continue
            const xFrom = x.checkInDate.slice(0, 10)
            const xTo = x.checkOutDate.slice(0, 10)
            if (xFrom < scope.from) scope.from = xFrom
            if (xTo > scope.to) scope.to = xTo
          }
        }
      }
      try {
        await apiMoveBookingNext(id)
        toast.success(t("calendarToast.moveNextDone"))
        invalidate(scope)
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          toast.error(e.message || t("calendarToast.moveNextFailed"))
          invalidate(scope)
        } else {
          onError(e, t("calendarToast.moveNextFailed"))
        }
        throw e
      }
    },
    [bookingsQ.rows, invalidate, onError],
  )

  const removeBlock = useCallback(
    async (id: string) => {
      const raw = isBlockId(id) ? blockIdOf(id) : id
      // Blok qamrovi keshdagi qatordan — blokda mehmon/tarix yo'q, sanalari yetarli.
      const bl = (blocksQ.data ?? []).find((x) => x.id === raw)
      try {
        await removeRoomBlock(raw)
        toast.success(t("calendarToast.unblocked"))
        invalidate(bl ? { from: bl.startDate.slice(0, 10), to: bl.endDate.slice(0, 10) } : undefined)
      } catch (e) {
        onError(e, t("calendarToast.unblockFailed"))
      }
    },
    [blocksQ.data, invalidate, onError],
  )

  // ── Tanlangan bronning mehmonlari + to'lov ledgeri ───────────────────────
  // Ro'yxat so'rovi faqat SONNI beradi (200 bron × qatorlar oynani sekinlashtirardi), to'liq
  // ro'yxat (mehmonlar VA to'lovlar — bitta javob) modal ochilganda shu query bilan keladi.
  // Blok tanlansa umuman so'ralmaydi.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const guestsQ = useQuery({
    queryKey: keys.bookingGuests(selectedId),
    queryFn: () => getBooking(selectedId as string),
    enabled: enabled && selectedId != null && !isBlockId(selectedId),
    staleTime: 30_000,
  })
  const guests = guestsQ.data?.guests ?? null

  // Faoliyat tarixi — alohida endpoint (log jadvalidan), modal ochiq turganda yuklanadi.
  const activityQ = useQuery({
    queryKey: keys.bookingActivity(selectedId),
    queryFn: () => getBookingActivity(selectedId as string),
    enabled: enabled && selectedId != null && !isBlockId(selectedId),
    staleTime: 15_000,
  })
  const activity = useMemo<CalendarActivityEntry[] | null>(
    () =>
      activityQ.data?.map((e) => ({
        id: e.id,
        action: e.action,
        actorName: e.actor?.name ?? null,
        at: e.createdAt,
        data: e.data,
      })) ?? null,
    [activityQ.data],
  )

  // Ledger qatori → yadro shakli. `canVoid` SHU YERDA hisoblanadi (yadro qoida bilmaydi):
  // o'z yozuvi + 15 daqiqa oynasi. Muddat o'tsa tugma chiqmaydi; chegara baribir serverda.
  const myUserId = getSession()?.user.id
  const payments = useMemo<CalendarPaymentEntry[] | null>(() => {
    const rows = guestsQ.data?.payments
    if (!rows) return null
    const now = Date.now()
    return rows.map((p: BookingPayment) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      note: p.note,
      receivedByName: p.receivedBy?.name ?? null,
      at: p.createdAt,
      voided: p.voidedAt != null,
      voidReason: p.voidReason,
      canVoid:
        p.voidedAt == null &&
        p.receivedBy?.id === myUserId &&
        now - new Date(p.createdAt).getTime() <= 15 * 60_000,
    }))
  }, [guestsQ.data?.payments, myUserId])

  /** Mehmon/to'lov amalidan keyingi yangilash — hammasi bitta bron atrofida, keng supurish shart emas. */
  const refreshGuests = useCallback(
    (bookingId: string) => {
      if (NARROW_INVALIDATION) {
        void qc.invalidateQueries({ queryKey: keys.bookingGuests(bookingId) })
        void qc.invalidateQueries({ queryKey: keys.bookingActivity(bookingId) })
      } else {
        void qc.invalidateQueries({ queryKey: keys.bookingGuestsAll })
        void qc.invalidateQueries({ queryKey: keys.bookingActivityAll })
      }
      // Bar'dagi mehmon soni va asosiy mehmon ismi ham o'zgargan bo'lishi mumkin — lekin
      // faqat shu bron turgan bo'laklarda.
      const scope = scopeOf(bookingId)
      if (NARROW_INVALIDATION && scope) {
        void qc.invalidateQueries({ queryKey: keys.bookingsAll, predicate: overlapsScope(scope) })
      } else {
        void qc.invalidateQueries({ queryKey: keys.bookingsAll })
      }
    },
    [qc, scopeOf],
  )

  const recordPayment = useCallback(
    async (
      bookingId: string,
      input: { amount: number; method: "cash" | "card" | "transfer"; note?: string; eventId: string },
    ) => {
      try {
        await recordBookingPayment(bookingId, input)
        toast.success(t("calendarToast.paymentTaken"))
        refreshGuests(bookingId)
      } catch (e) {
        // Server guard'i: naqd uchun faol smena kerak (gate fail-open'dan o'tilgan yoki smena
        // hozirgina yopilgan holat). Aniq yo'l ko'rsatamiz — ShiftCard'dagi "Boshlash".
        if (e instanceof ApiError && (e.body as { code?: string })?.code === "SHIFT_REQUIRED") {
          toast.error(t("shiftSession.required"))
          void qc.invalidateQueries({ queryKey: shiftKeys.all })
          throw e
        }
        onError(e, t("calendarToast.paymentFailed"))
        throw e // forma ochiq qolsin — xodim summani qaytadan termasin
      }
    },
    [refreshGuests, onError],
  )

  const voidPayment = useCallback(
    async (bookingId: string, paymentId: string, input: { reason: string; cashReturned?: boolean }) => {
      try {
        await voidBookingPayment(bookingId, paymentId, input)
        toast.success(t("calendarToast.paymentVoided"))
        refreshGuests(bookingId)
      } catch (e) {
        onError(e, t("calendarToast.voidFailed"))
        throw e
      }
    },
    [refreshGuests, onError],
  )

  /** Mehmon amallari bir xil qolipda: bajarish → xabar → ikkala keshni yangilash. */
  const guestAction = useCallback(
    async (bookingId: string, run: () => Promise<unknown>, ok: string, fail: string) => {
      try {
        await run()
        toast.success(ok)
        refreshGuests(bookingId)
      } catch (e) {
        onError(e, fail)
      }
    },
    [refreshGuests, onError],
  )

  const addGuest = useCallback(
    (bookingId: string, guest: LooseGuestInput) =>
      guestAction(
        bookingId,
        () => addBookingGuest(bookingId, toGuestInput(guest)),
        t("calendarToast.guestAdded"),
        t("calendarToast.guestAddFailed"),
      ),
    [guestAction],
  )
  const updateGuest = useCallback(
    (bookingId: string, guestId: string, patch: Partial<LooseGuestInput>) =>
      guestAction(
        bookingId,
        () => updateBookingGuest(bookingId, guestId, toGuestPatch(patch)),
        t("calendarToast.saved"),
        t("calendarToast.saveFailed"),
      ),
    [guestAction],
  )
  const removeGuest = useCallback(
    (bookingId: string, guestId: string) =>
      guestAction(bookingId, () => removeBookingGuest(bookingId, guestId), t("calendarToast.guestRemoved"), t("calendarToast.removeFailed")),
    [guestAction],
  )
  const makeGuestPrimary = useCallback(
    (bookingId: string, guestId: string) =>
      guestAction(bookingId, () => apiSetPrimaryGuest(bookingId, guestId), t("calendarToast.primaryChanged"), t("calendarToast.primaryFailed")),
    [guestAction],
  )

  // Xato FAQAT ko'rsatadigan narsa bo'lmaganda "fatal" (satrga YIG'ILMAYDI — xom obyekt
  // yuqoriga chiqadi, sahifa undan sabab + retry chizadi). Fon poll'i yiqilsa data turibdi →
  // kalendar ochiq qoladi, react-query keyingi siklda o'zi qayta uradi.
  const error = enabled
    ? roomsQ.data === undefined && roomsQ.error
      ? roomsQ.error
      : !bookingsQ.firstHasData && bookingsQ.error
        ? bookingsQ.error
        : null
    : null

  /** Yiqilgan kalendar so'rovlarinigina qayta uradi — muvaffaqiyatlilari keshdan turaveradi. */
  const retry = useCallback(
    () =>
      qc.refetchQueries({
        predicate: (q) =>
          q.state.status === "error" &&
          (q.queryKey[0] === "rooms" || q.queryKey[0] === "bookings" || q.queryKey[0] === "room-blocks"),
      }),
    [qc],
  )

  return {
    rooms,
    bookings,
    organizations,
    roomlessCount,
    isLoading: enabled && (roomsQ.isLoading || bookingsQ.isLoading),
    error,
    retry,
    createBooking,
    checkIn,
    checkOut,
    cancel,
    editBooking,
    moveBooking,
    splitBooking,
    moveNext,
    removeBlock,
    selectGuestsFor: setSelectedId,
    guests,
    guestsLoading: guestsQ.isLoading,
    addGuest,
    updateGuest,
    removeGuest,
    makeGuestPrimary,
    payments,
    recordPayment,
    voidPayment,
    activity,
    activityLoading: activityQ.isLoading,
  }
}
