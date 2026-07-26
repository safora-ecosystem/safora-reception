import { clearSession, getSession, updateTokens, type Session } from "./auth"

const BASE_URL = import.meta.env.VITE_API_URL

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_BASE_MS = 400
const RETRYABLE_STATUS = new Set([502, 503, 504])

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    const message =
      typeof (body as { message?: unknown })?.message === "string"
        ? ((body as { message: string }).message)
        : `API ${status}`
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

/** `fetch` umuman javob ololmaganda (tarmoq uzilgan, server o'lik, timeout) otiladi — brauzerning
    xom "Failed to fetch" TypeError'i o'rniga tushunarli, typed xato. UI shu message'ni ko'rsatadi. */
export class NetworkError extends Error {
  readonly cause: unknown
  constructor(cause: unknown) {
    super("Server bilan aloqa yo'q. Internet aloqangizni tekshiring yoki birozdan so'ng qayta urining.")
    this.name = "NetworkError"
    this.cause = cause
  }
}

type ApiOptions = {
  method?: string
  body?: unknown
  token?: string
  signal?: AbortSignal
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function rawFetch(
  path: string,
  { method = "GET", body, signal }: ApiOptions,
  token?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const hasBody = body !== undefined
  // Timeout har urinishda YANGI (bir martalik); chaqiruvchi signalini (mas. unmount) ham hurmat qilamiz.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs)
  const onCallerAbort = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener("abort", onCallerAbort, { once: true })
  }
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      // Only advertise a JSON body when we actually send one — Fastify rejects an empty
      // `application/json` body with 400, so bodyless GET/DELETE must NOT set content-type.
      headers: {
        ...(hasBody ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onCallerAbort)
  }
}

/** rawFetch + idempotent retry: tarmoq/timeout xatosi yoki 502/503/504'da GET'ni backoff bilan
    qayta uradi; chaqiruvchi ataylab bekor qilsa (unmount) — retry yo'q, propagate. So'rov umuman
    yetib bormasa NetworkError. */
async function sendWithRetry(path: string, options: ApiOptions, token: string | undefined): Promise<Response> {
  const idempotent = (options.method ?? "GET").toUpperCase() === "GET"
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await rawFetch(path, options, token)
      if (idempotent && RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_MS * 2 ** attempt)
        continue
      }
      return res
    } catch (err) {
      if (options.signal?.aborted) throw err // chaqiruvchi bekor qildi — bu retry emas
      if (idempotent && attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_MS * 2 ** attempt)
        continue
      }
      throw new NetworkError(err)
    }
  }
}

// Bir vaqtda kelgan 401'lar bitta refresh so'rovini ULASHADI. Refresh token bir martalik
// (rotatsiya) — parallel refresh'lar bir-birini revoke qilib TASODIFIY LOGOUT qilardi. Birinchi
// chaqiruvchi refresh qiladi, qolganlari o'sha natijani kutadi.
let refreshInFlight: Promise<Session | null> | null = null

function refreshSession(refreshToken: string): Promise<Session | null> {
  refreshInFlight ??= rawFetch("/auth/refresh", { method: "POST", body: { refreshToken } })
    .then(async (res) => {
      if (!res.ok) return null
      const next = (await res.json()) as Session
      updateTokens(next.accessToken, next.refreshToken)
      return next
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

/** Sessiya tokenini avtomatik qo'shadi; access eskirgan bo'lsa (401) bir marta refresh qilib
    qayta urinadi (single-flight), refresh ham o'lgan bo'lsa sessiyani tozalab /login'ga qaytaradi. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = getSession()
  let res = await sendWithRetry(path, options, options.token ?? session?.accessToken)

  if (res.status === 401 && !options.token && session?.refreshToken) {
    const next = await refreshSession(session.refreshToken)
    if (next) {
      res = await sendWithRetry(path, options, next.accessToken)
    } else if (path !== "/auth/login") {
      clearSession()
      window.location.assign("/login")
      throw new ApiError(401, { message: "Seans muddati tugadi — qayta kiring" })
    }
  }

  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, payload)
  return payload as T
}

// ── core-api domen tiplari (reception ishlatadigan qismi) ──────────────────

export type BookingStatus = "booked" | "checked_in" | "checked_out" | "cancelled"

export type Room = {
  id: string
  number: string
  type: string
  floor: number | null
  /** Decimal backend'da — string yoki number bo'lib kelishi mumkin. */
  rate?: number | string
  /** Standart joy soni. `null` = belgilanmagan (UI mehmon soni haqida gapirmaydi).
      QAT'IY CHEGARA EMAS — sig'imdan ortiq mehmon faqat ogohlantirish chiqaradi. */
  capacity?: number | null
}

/** Hujjat turlari — backend `guest_doc_type` enum'i bilan bir xil. */
export type GuestDocType = "passport" | "id_card" | "birth_certificate" | "driver_license" | "other"

/** Bronda yashovchi bitta mehmon. Asosiysi (`isPrimary`) bron ustunlari bilan sinxron:
    mehmon QR check-in aynan uning telefonining oxirgi 4 raqamiga tayanadi. */
export type BookingGuest = {
  id: string
  fullName: string
  phone: string | null
  docType: GuestDocType | null
  docNumber: string | null
  isPrimary: boolean
}

export type GuestInput = {
  fullName: string
  phone?: string
  docType?: GuestDocType
  docNumber?: string
}

export type Booking = {
  id: string
  guestName: string
  guestPhone: string | null
  /** date-only (ISO, vaqt qismi 00:00Z) — @db.Date */
  checkInDate: string
  checkOutDate: string
  status: BookingStatus
  /** Decimal(12,2) — string/number. Kalendar to'lov indikatori uchun. */
  totalAmount?: number | string
  paidAmount?: number | string
  /** Mehmon QR orqali kelishini tasdiqlaganmi. */
  guestConfirmed?: boolean
  /** Haqiqiy kirish/chiqish MOMENTI (timestamptz) — rejadagi kundan farqli, `null` = bo'lmagan. */
  checkedInAt?: string | null
  checkedOutAt?: string | null
  createdAt?: string
  room: { id: string; number: string }
  /** Resepshn eslatmasi (smenalar orasida ma'lumot uzatish). */
  note?: string | null
  /** To'liq ro'yxat FAQAT `GET /bookings/:id` javobida — kalendar ro'yxatida sanoq keladi. */
  guests?: BookingGuest[]
  _count?: { guests: number }
}

/** Mehmonsiz bandlik: ta'mir, chuqur tozalash yoki ushlab turish. Bron EMAS — alohida jadval,
    chunki hisobotlar bronlarni status bo'yicha sanaydi va blok o'sha raqamlarga kirib ketardi. */
export type RoomBlockKind = "maintenance" | "cleaning" | "hold" | "other"

export type RoomBlock = {
  id: string
  kind: RoomBlockKind
  reason: string | null
  /** date-only (ISO); `endDate` exclusive — bronlar bilan bir xil konvensiya. */
  startDate: string
  endDate: string
  room: { id: string; number: string }
}

export const listRooms = () => api<Room[]>("/rooms")

/** Kalendar oynasi bo'yicha bron ro'yxati. Parametrsiz (statistika) = butun ro'yxat. */
export const listBookings = (from?: string, to?: string) => {
  const qs = new URLSearchParams()
  if (from) qs.set("from", from)
  if (to) qs.set("to", to)
  const q = qs.toString()
  return api<Booking[]>(`/bookings${q ? `?${q}` : ""}`)
}

export type BulkBookingRoom = {
  roomId: string
  totalAmount: number
  paidAmount?: number
}

export type CreateBookingsBody = {
  guestName: string
  guestPhone: string
  guestDocType?: GuestDocType
  guestDocNumber?: string
  guests?: GuestInput[]
  note?: string
  checkInDate: string
  checkOutDate: string
  rooms: BulkBookingRoom[]
}

export const createBookings = (body: CreateBookingsBody) =>
  api<Booking[]>("/bookings/bulk", { method: "POST", body })

export const getBooking = (id: string) => api<Booking>(`/bookings/${id}`)

// ── Mehmonlar ─────────────────────────────────────────────────────────────────
// Hammasi TO'LIQ bronni qaytaradi — modal bitta javob bilan yangilanadi.

export const addBookingGuest = (bookingId: string, body: GuestInput) =>
  api<Booking>(`/bookings/${bookingId}/guests`, { method: "POST", body })

export const updateBookingGuest = (bookingId: string, guestId: string, body: Partial<GuestInput>) =>
  api<Booking>(`/bookings/${bookingId}/guests/${guestId}`, { method: "PATCH", body })

// PATCH bodyless — api() content-type qo'ymaydi (Fastify bo'sh-body gotcha).
export const setPrimaryGuest = (bookingId: string, guestId: string) =>
  api<Booking>(`/bookings/${bookingId}/guests/${guestId}/primary`, { method: "PATCH" })

export const removeBookingGuest = (bookingId: string, guestId: string) =>
  api<Booking>(`/bookings/${bookingId}/guests/${guestId}`, { method: "DELETE" })

// ── Xona bloklari ─────────────────────────────────────────────────────────────

export const listRoomBlocks = (from?: string, to?: string) => {
  const qs = new URLSearchParams()
  if (from) qs.set("from", from)
  if (to) qs.set("to", to)
  const q = qs.toString()
  return api<RoomBlock[]>(`/room-blocks${q ? `?${q}` : ""}`)
}

export type CreateRoomBlockBody = {
  roomId: string
  kind?: RoomBlockKind
  reason?: string
  startDate: string
  endDate: string
}

export const createRoomBlock = (body: CreateRoomBlockBody) =>
  api<RoomBlock>("/room-blocks", { method: "POST", body })

export const updateRoomBlock = (id: string, body: Partial<CreateRoomBlockBody>) =>
  api<RoomBlock>(`/room-blocks/${id}`, { method: "PATCH", body })

export const removeRoomBlock = (id: string) =>
  api<{ ok: true }>(`/room-blocks/${id}`, { method: "DELETE" })

/** Faqat o'zgargan maydonlar yuboriladi (PATCH semantikasi). Xona yoki sana o'zgarishini server
    faqat `booked` holatda qabul qiladi (aks holda 409) va create bilan AYNAN bir xil overlap
    qulfidan o'tkazadi — ya'ni klient tekshiruvi qulaylik, haqiqiy chegara serverda. */
export type UpdateBookingBody = {
  roomId?: string
  guestName?: string
  guestPhone?: string
  checkInDate?: string
  checkOutDate?: string
  totalAmount?: number
  /** To'langan summa; server `paidAmount ≤ totalAmount` shartini majburlaydi. */
  paidAmount?: number
  /** Bo'sh satr = eslatmani tozalash (`undefined` = tegilmadi). */
  note?: string
}

export const updateBooking = (id: string, body: UpdateBookingBody) =>
  api<Booking>(`/bookings/${id}`, { method: "PATCH", body })
// PATCH bodyless — api() content-type qo'ymaydi (Fastify bo'sh-body gotcha).
export const checkInBooking = (id: string) => api<Booking>(`/bookings/${id}/check-in`, { method: "PATCH" })
export const checkOutBooking = (id: string) => api<Booking>(`/bookings/${id}/check-out`, { method: "PATCH" })
export const cancelBooking = (id: string) => api<Booking>(`/bookings/${id}/cancel`, { method: "PATCH" })

// ── Mehmonlar direktoriyasi (GET /guests) ────────────────────────────────────

/** `in_house` — hozir yashayapti · `arriving` — kutilmoqda · `past` — chiqib ketgan. */
export type GuestState = "in_house" | "arriving" | "past"

/** Bir ODAM (bron emas): takroriy tashriflar bitta qatorga yig'ilgan. Kalit — telefon
    (bor bo'lsa), aks holda normalizatsiyalangan ism. Yig'ish backendda. */
export type DirectoryGuest = {
  key: string
  fullName: string
  phone: string | null
  docType: GuestDocType | null
  docNumber: string | null
  stays: number
  nights: number
  totalPaid: number
  firstStay: string
  lastStay: string
  state: GuestState
  currentRoom: string | null
  currentBookingId: string | null
  note: string | null
}

export const listGuests = () => api<DirectoryGuest[]>("/guests")

// ── Xizmat so'rovlari (GET/POST/PATCH /service-requests) ─────────────────────

export type ServiceType = "taxi" | "cleaning" | "food" | "amenity" | "other"
export type ServiceRequestStatus = "new" | "in_progress" | "done" | "cancelled"

/** Mehmon buyurtmasi. `title`/`commissionRate` katalogdan SNAPSHOT — katalog keyin
    o'zgarsa ham bu yozuv o'z paytidagi shartni aytib turadi. */
export type ServiceRequest = {
  id: string
  title: string
  type: ServiceType
  note: string | null
  status: ServiceRequestStatus
  source: "guest" | "staff"
  amount: string
  commissionRate: string
  createdAt: string
  acceptedAt: string | null
  completedAt: string | null
  room: { id: string; number: string; type: string }
  booking: { id: string; guestName: string; guestPhone: string | null } | null
  service: { id: string; name: string } | null
  assignedTo: { id: string; name: string; role: string } | null
}

export type ServiceRequestStats = {
  windowDays: number
  counts: Record<ServiceRequestStatus, number>
  revenue: number
  commission: number
}

/** Mehmonxona xizmat katalogi (`GET /services`) — so'rov yaratishda tanlanadi. */
export type ServiceCatalogItem = {
  id: string
  name: string
  type: ServiceType
  commissionRate: string
  active: boolean
}

export const listServiceRequests = (status?: ServiceRequestStatus) =>
  api<ServiceRequest[]>(`/service-requests${status ? `?status=${status}` : ""}`)

export const getServiceRequestStats = () => api<ServiceRequestStats>("/service-requests/stats")

export type CreateServiceRequestBody = {
  roomId: string
  bookingId?: string
  serviceId?: string
  title?: string
  type?: ServiceType
  note?: string
  amount?: number
}

export const createServiceRequest = (body: CreateServiceRequestBody) =>
  api<ServiceRequest>("/service-requests", { method: "POST", body })

export const updateServiceRequest = (
  id: string,
  body: { status?: ServiceRequestStatus; note?: string; amount?: number; assignedToId?: string },
) => api<ServiceRequest>(`/service-requests/${id}`, { method: "PATCH", body })

// ── Faol seanslar (qurilmalar) ────────────────────────────────────────────────

export type ActiveSession = {
  id: string
  device: string
  ip: string | null
  lastActiveAt: string
  signedInAt: string
  current: boolean
}

export const listSessions = () => api<ActiveSession[]>("/auth/sessions")
export const revokeSession = (id: string) =>
  api<void>(`/auth/sessions/${id}/revoke`, { method: "POST" })
export const revokeOtherSessions = () =>
  api<{ revoked: number }>("/auth/sessions/revoke-others", { method: "POST" })

// ── Mehmonxona brendi ───────────────────────────────────────────────────────

/** Mehmonxona qoidalari (GET /hotel → `policy`). Bitta manba backend'da; admin/owner
    panellari TAHRIRLAYDI, reception faqat O'QIYDI. Hozircha kalendar faqat `checkInTime`/
    `checkOutTime`ni ishlatadi — backend policy obyekti kengroq (early/late check-in, bekor
    qilish, no-show, bola/uy hayvoni/chekish qoidalari). Reception qolganlarini o'qiy boshlaganda
    (masalan "Mehmonxona qoidalari" reference paneli) shu tipga qo'shiladi. Barcha maydon
    ixtiyoriy: backend bermasa iste'molchi o'z default'iga tushadi. */
export type HotelPolicy = {
  /** "HH:MM" (24h) — standart kirish vaqti. Yo'q bo'lsa kalendar 14:00 ko'rsatadi. */
  checkInTime?: string | null
  /** "HH:MM" (24h) — standart chiqish vaqti. Yo'q bo'lsa kalendar 12:00 ko'rsatadi. */
  checkOutTime?: string | null
}

/** Kirgan xodim biriktirilgan mehmonxonaning panel brendi + qoidalari (GET /hotel).
    `longLogoUrl` yo'q bo'lsa (yoki hali yuklanmagan) panel Safora logotipiga tushadi. */
export type HotelBranding = {
  name: string
  logoUrl: string | null
  longLogoUrl: string | null
  /** Mehmonxona qoidalari; ixtiyoriy (backend bosqichma-bosqich to'ldiradi). */
  policy?: HotelPolicy | null
}

export const getHotelBranding = () => api<HotelBranding>("/hotel")

// ── Platforma e'loni ────────────────────────────────────────────────────────

/** E'lonning og'irligi — banner rangini va ohangini shu belgilaydi. */
export type NoticeLevel = "info" | "warning" | "maintenance"

/** Platformadan kelgan e'lon. `null` = e'lon yo'q, o'chiq, yoki resepshnga qaratilmagan. */
export type PanelNotice = { level: NoticeLevel; message: string; updatedAt: string } | null

/** Admin panelidagi Sozlamalar → Panel e'loni shu yerga yozadi. Endpoint ommaviy: token
    talab qilmaydi, chunki texnik ishlar paytida odam aynan **kira olmay** turib sababini
    bilishi kerak. */
export const getPanelNotice = () => api<PanelNotice>("/platform/notice?panel=reception")

// ── Chat (mehmon ↔ reception) ─────────────────────────────────────────────────

export type ChatSender = "guest" | "staff"

/** Inbox qatori — bir booking = bitta suhbat. Oxirgi xabar + o'qilmagan soni serverdan keladi. */
export type ChatConversation = {
  bookingId: string
  roomNumber: string
  guestName: string
  bookingStatus: BookingStatus
  lastMessageAt: string
  lastMessagePreview: string | null
  lastMessageSender: ChatSender | null
  unread: number
}

export type ChatMessage = {
  id: string
  bookingId: string
  senderType: ChatSender
  /** staff xabari — javob bergan xodim id'si; mehmon xabari — null. */
  senderUserId: string | null
  text: string
  createdAt: string
}

/** Keyset sahifa: items yangi→eski tartibda; nextCursor = eskiroq sahifa uchun (yoki null). */
export type ChatPage<T> = { items: T[]; nextCursor: string | null }

export const listConversations = () => api<ChatPage<ChatConversation>>("/chat/conversations")

export const listChatMessages = (bookingId: string, cursor?: string) => {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
  return api<ChatPage<ChatMessage>>(`/chat/conversations/${bookingId}/messages${qs}`)
}

export const sendChatMessage = (bookingId: string, text: string) =>
  api<ChatMessage>(`/chat/conversations/${bookingId}/messages`, { method: "POST", body: { text } })

// POST bodyless — api() content-type qo'ymaydi (Fastify bo'sh-body gotcha).
export const markChatRead = (bookingId: string) =>
  api<{ ok: true }>(`/chat/conversations/${bookingId}/read`, { method: "POST" })

/** Real-time: connection token + WS URL (Centrifugo). Reception connect'da o'z inbox'iga avto-obuna. */
export const chatRtConnect = () =>
  api<{ token: string; url: string }>("/chat/rt/connect", { method: "POST" })

/** Bitta suhbat kanaliga subscription token — server tenant/booking'ni tekshiradi (begonaga 403). */
export const chatRtSubscribe = (channel: string) =>
  api<{ token: string }>("/chat/rt/subscribe", { method: "POST", body: { channel } })

export function staffLogin(
  staffHandle: string,
  password: string,
  turnstileToken: string | null,
): Promise<Session> {
  // `panel` — bu reception paneli: backend faqat role=reception hisobiga sessiya beradi,
  // owner/manager o'z paneliga yo'naltiriladi (403 + havola).
  return api<Session>("/auth/login", {
    method: "POST",
    body: { staffHandle, password, panel: "reception", ...(turnstileToken ? { turnstileToken } : {}) },
  })
}

export async function staffLogout(): Promise<void> {
  try {
    await api<void>("/auth/logout", { method: "POST" })
  } catch {
    // tarmoq xatosi chiqishga to'sqinlik qilmasin — lokal sessiya baribir tozalanadi
  } finally {
    clearSession()
  }
}
