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
      throw new ApiError(401, { message: "Sessiya muddati tugadi — qayta kiring" })
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

export type CreateBookingBody = {
  roomId: string
  guestName: string
  guestPhone?: string
  checkInDate: string
  checkOutDate: string
  totalAmount: number
}

export const createBooking = (body: CreateBookingBody) => api<Booking>("/bookings", { method: "POST", body })

export type UpdateBookingBody = {
  roomId?: string
  guestName?: string
  guestPhone?: string
  checkInDate?: string
  checkOutDate?: string
  totalAmount?: number
}

export const updateBooking = (id: string, body: UpdateBookingBody) =>
  api<Booking>(`/bookings/${id}`, { method: "PATCH", body })
// PATCH bodyless — api() content-type qo'ymaydi (Fastify bo'sh-body gotcha).
export const checkInBooking = (id: string) => api<Booking>(`/bookings/${id}/check-in`, { method: "PATCH" })
export const checkOutBooking = (id: string) => api<Booking>(`/bookings/${id}/check-out`, { method: "PATCH" })
export const cancelBooking = (id: string) => api<Booking>(`/bookings/${id}/cancel`, { method: "PATCH" })

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
