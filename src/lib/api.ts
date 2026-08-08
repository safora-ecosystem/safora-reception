import { clearSession, getSession, updateAccessExpiry, type Session } from "./auth"
import { t } from "./i18n"

const BASE_URL = import.meta.env.VITE_API_URL

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_BASE_MS = 400
const RETRYABLE_STATUS = new Set([502, 503, 504])

export const SHIFT_REQUIRED_EVENT = "safora:shift-required"

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
    xom "Failed to fetch" TypeError'i o'rniga tushunarli, typed xato.

    `message` — TEXNIK satr (log/diagnostika uchun), ekranga CHIQMAYDI. Sabab: xato obyekti bir
    marta yaratiladi, til esa keyin almashishi mumkin — foydalanuvchi matni `apiErrorText()` da,
    ya'ni ko'rsatish paytida tarjima qilinadi. */
export class NetworkError extends Error {
  readonly cause: unknown
  constructor(cause: unknown) {
    super("Network unreachable")
    this.name = "NetworkError"
    this.cause = cause
  }
}

type ApiOptions = {
  method?: string
  body?: unknown
  signal?: AbortSignal
  /** Standart 15s. Fayl yuklashda uzunroq: sekin mobil ulanishda 8MB shunga sig'maydi. */
  timeoutMs?: number
}

/** Panel o'zini shu sarlavhada tanitadi — backend seans cookie'sini shu nom bo'yicha topadi
    (har panelning o'z cookie'si bor, aks holda ikkinchi panelga kirish birinchisini o'chirardi). */
export const PANEL_HEADER: Record<string, string> = { "x-panel": "reception" }

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function rawFetch(
  path: string,
  { method = "GET", body, signal, timeoutMs: callerTimeout }: ApiOptions,
  timeoutMs = callerTimeout ?? DEFAULT_TIMEOUT_MS,
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
  // Fayl yuklash (profil rasmi) — FormData JSON'ga o'ralmaydi va content-type QO'YILMAYDI:
  // uni brauzer o'zi yozadi, chunki multipart chegara satri (boundary) shu yerda tug'iladi.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      // Seans `httpOnly` cookie'da: brauzer uni FAQAT shu bayroq bilan qo'shadi.
      credentials: "include",
      // Only advertise a JSON body when we actually send one — Fastify rejects an empty
      // `application/json` body with 400, so bodyless GET/DELETE must NOT set content-type.
      headers: {
        ...(hasBody && !isForm ? { "content-type": "application/json" } : {}),
        ...PANEL_HEADER,
      },
      ...(hasBody ? { body: isForm ? (body as FormData) : JSON.stringify(body) } : {}),
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
async function sendWithRetry(path: string, options: ApiOptions): Promise<Response> {
  const idempotent = (options.method ?? "GET").toUpperCase() === "GET"
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await rawFetch(path, options)
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

// Refresh — TABLAR ARASIDA ham bitta. Ilgari navbat faqat shu tab ichida edi va aynan shu
// tasodifiy logoutning asosiy sababi bo'lgan: refresh tokeni BIR MARTALIK (server rotatsiya
// qiladi), ya'ni bitta panelning ikkita tabi bir vaqtda yangilasa, ikkinchisining qo'lidagi
// token o'lik bo'lib qolardi va keyingi so'rovda odam tizimdan chiqib ketardi. Front-deskda
// esa ikki-uch tab ochiq turishi odatiy hol.
//
// Endi Web Locks bilan navbat: qulfni olgan tab AVVAL storage'ni qayta o'qiydi — boshqa tab
// allaqachon yangilagan bo'lsa, umuman so'rov yubormaydi.
const REFRESH_LOCK = "safora-refresh"
/** Access tokenda shu vaqtdan ko'proq qolgan bo'lsa yangilash shart emas. */
const FRESH_MARGIN_SEC = 30

/** Server "bu token o'lik" degan yagona holat. Tarmoq/5xx bundan FARQ qiladi. */
class SessionExpiredError extends Error {}

// Refresh tokeni so'rov TANASIDA emas: u `httpOnly` cookie'da va brauzer uni /auth/refresh
// yo'liga o'zi qo'shadi. Muddat esa seansdan o'qiladi — JWT endi panelga ko'rinmaydi.
async function runRefresh(): Promise<Session | null> {
  const current = getSession()
  if (!current) return null
  // Qulfni kutayotganda boshqa tab yangilab qo'ygan bo'lishi mumkin — u holda so'rov shart emas.
  if (current.accessExpiresAt - Date.now() / 1000 > FRESH_MARGIN_SEC) return current

  const res = await rawFetch("/auth/refresh", { method: "POST", body: {} })
  if (res.ok) {
    const next = (await res.json()) as Session
    updateAccessExpiry(next.accessExpiresAt)
    return next
  }
  // FAQAT server tokenni rad etsa sessiya tugaydi. 5xx yoki tarmoq uzilishi vaqtinchalik
  // nosozlik — odamni ish o'rtasida tizimdan chiqarib yuborish uchun sabab emas.
  if (res.status === 401 || res.status === 403) throw new SessionExpiredError()
  return null
}

let refreshInFlight: Promise<Session | null> | null = null

function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= (
    typeof navigator !== "undefined" && "locks" in navigator
      ? navigator.locks.request(REFRESH_LOCK, runRefresh)
      : runRefresh()
  ).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

/** Seans cookie'sini brauzer o'zi qo'shadi; access eskirgan bo'lsa (401) bir marta refresh qilib
    qayta urinadi (single-flight), refresh ham o'lgan bo'lsa sessiyani tozalab /login'ga qaytaradi. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = getSession()
  let res = await sendWithRetry(path, options)

  if (res.status === 401 && session) {
    let next: Session | null = null
    try {
      next = await refreshSession()
    } catch (err) {
      if (err instanceof SessionExpiredError && path !== "/auth/login") {
        clearSession()
        window.location.assign("/login")
        throw new ApiError(401, { message: t("errors.sessionExpiredShort") })
      }
      throw err
    }
    // `next` null bo'lsa — vaqtinchalik nosozlik. Sessiya saqlanadi, chaqiruvchi oddiy
    // xatolikni oladi va keyingi urinishda hammasi tiklanadi.
    if (next) res = await sendWithRetry(path, options)
  }

  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    // Server smena darvozasi (zero-trust): faol g'aladon sessiyasisiz reception hech narsani
    // o'zgartira olmaydi. Kim so'rov yuborganidan qat'i nazar shu yerdan bitta signal chiqadi —
    // ShiftGate uni eshitib gate'ni darrov qaytaradi (import bog'lamasi yo'q: kutubxona
    // qatlami UI qatlamiga bog'lanib qolmasin).
    if (res.status === 409 && (payload as { code?: string } | null)?.code === "SHIFT_REQUIRED") {
      window.dispatchEvent(new Event(SHIFT_REQUIRED_EVENT))
    }
    throw new ApiError(res.status, payload)
  }
  return payload as T
}

/** Xatoni odam o'qiydigan matnga aylantiradi — boshqa panellardagi bilan BIR XIL funksiya.
    Server o'z xabarini bergan bo'lsa (masalan kvota tugagani) aynan u ko'rsatiladi: u kontekstni
    bizdan yaxshi biladi. Faqat status'dan bilinadigan holatlar undan oldin tekshiriladi. */
export function apiErrorText(err: unknown, fallback = t("errors.generic")): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return t("errors.sessionExpiredShort")
    if (err.status === 403) return t("errors.forbiddenShort")
    if (err.status >= 500) return t("errors.serverShort")
    // Server matni TARJIMA QILINMAYDI — u backend tilida keladi va kontekstni bizdan yaxshi
    // biladi (kvota, validatsiya tafsiloti). Backend `Accept-Language` ni qo'llagach shu joy
    // o'zidan o'zi to'g'ri tilda gapiradi.
    const serverMsg = (err.body as { message?: unknown } | null)?.message
    if (typeof serverMsg === "string" && serverMsg) return serverMsg
    return fallback
  }
  if (err instanceof NetworkError) return t("errors.noConnection")
  return fallback
}

// ── core-api domen tiplari (reception ishlatadigan qismi) ──────────────────

export type BookingStatus = "booked" | "checked_in" | "checked_out" | "cancelled"

/** Qo'shimcha xarajat (ovqat, xizmat) — `payments` kabi append-only, storno bilan. */
export type BookingCharge = {
  id: string
  kind: "kitchen" | "service"
  /** Hujjatda chiqadigan matn — backendda MUHRLANGAN, panel uni qayta yasamaydi. */
  title: string
  amount: number | string
  taxable: boolean
  createdBy: { id: string; name: string } | null
  voidedAt: string | null
  voidedBy: { id: string; name: string } | null
  voidReason: string | null
  createdAt: string
}

/** Tozalash holati — backend `housekeeping_status` enum'i bilan bir xil. Resepshn va
    housekeeping mobil ilovasi AYNAN shu maydonni o'qiydi, ikkinchi haqiqat manbai yo'q. */
export type HousekeepingStatus = "clean" | "dirty" | "in_progress"

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
  housekeepingStatus?: HousekeepingStatus
  housekeepingUpdatedAt?: string | null
  /** Xonadagi QR stikeri ochadigan manzil. Backend'da `qrToken`dan HOSILA — saqlanmaydi. */
  scanUrl?: string
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

/** To'lov usuli. `adjustment` — eski `PATCH paidAmount` yo'lidan tushgan qo'lda tuzatish
    (manfiy bo'lishi mumkin), formada tanlanmaydi. Qolgan uchtasi resepshn tanlaydi: mehmonxonalar
    naqd va karta (POS) bilan ishlaydi, usulni to'g'ri yozish kassa (smena) hisobining o'zagi —
    karta puli g'aladonga jismonan tushmaydi. */
export type PaymentMethod = "cash" | "card" | "transfer" | "adjustment"

/** Formada tanlanadigan usullar (backend `RECORDABLE_METHODS` bilan mos). */
export const RECORDABLE_METHODS = ["cash", "card", "transfer"] as const
export type RecordableMethod = (typeof RECORDABLE_METHODS)[number]

/** To'lov LEDGERI qatori — append-only: o'chirilmaydi, xato yozuv storno (`voided*`) bilan
    bekor qilinadi va ro'yxatda ko'rinib qoladi. `bookings.paidAmount` = shu qatorlarning
    (storno bo'lmaganlarining) yig'indisi. */
export type BookingPayment = {
  id: string
  /** Decimal — string/number bo'lib keladi. Manfiy = adjustment (pasaytirish). */
  amount: number | string
  method: PaymentMethod
  note: string | null
  receivedBy: { id: string; name: string } | null
  voidedAt: string | null
  voidedBy: { id: string; name: string } | null
  voidReason: string | null
  createdAt: string
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
  /**
   * BO'LINGAN yashash zanjirining kaliti. Mehmon yashash o'rtasida boshqa xonaga ko'chsa
   * (`POST /bookings/:id/split`) ikkala qism ham SHU id ni oladi. Qismlar mustaqil bron bo'lib
   * qoladi — zanjir faqat "bu bitta mehmonning bitta yashashi" faktini saqlaydi: kalendar
   * shundan uzuq chiziqli izni chizadi, hisob-faktura esa qismlarni bitta hujjatga yig'adi.
   */
  linkId?: string | null
  /** Resepshn eslatmasi (smenalar orasida ma'lumot uzatish). */
  note?: string | null
  /** Tashqi kanal broni raqami (OTA). Hisob-fakturada "Bron №" sifatida chiqadi — mehmon
      qog'ozdagi raqam bilan o'z tasdig'ini solishtira olsin. */
  externalRef?: string | null
  /** Kim TO'LAYDI. `null` = mehmonning o'zi; to'ldirilgan bo'lsa hisob kompaniyaga yoziladi
      va resepshn undan pul olmaydi (ro'yxat javobida ham keladi — bar shuni ko'rsatadi). */
  organization?: { id: string; name: string; shortName: string | null; status: OrganizationStatus } | null
  /** Kafolat xati / buyurtma raqami (korporativ bronda). */
  orgRef?: string | null
  /** To'liq ro'yxat FAQAT `GET /bookings/:id` javobida — kalendar ro'yxatida sanoq keladi. */
  guests?: BookingGuest[]
  /** To'lov ledgeri — FAQAT detal javobida (`GET /bookings/:id` va mutatsiya javoblari). */
  payments?: BookingPayment[]
  /** Qo'shimcha xarajatlar. Bekor qilinganlari HAM keladi — folio'da ular ko'rinib turadi. */
  charges?: BookingCharge[]
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
  eventId?: string
  guestName?: string
  guestPhone?: string
  guestDocType?: GuestDocType
  guestDocNumber?: string
  guests?: GuestInput[]
}

export type CreateBookingsBody = {
  guestName?: string
  guestPhone?: string
  guestDocType?: GuestDocType
  guestDocNumber?: string
  guests?: GuestInput[]
  note?: string
  checkInDate: string
  checkOutDate: string
  organizationId?: string
  orgRef?: string
  method?: RecordableMethod
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
  // paidAmount OLIB TASHLANGAN: to'langan pul faqat ledger endpointlari orqali o'zgaradi.
  // PATCH-paidAmount serverda legacy 'adjustment'ga aylanadi — bu panel uni ishlatmaydi.
  /** Bo'sh satr = eslatmani tozalash (`undefined` = tegilmadi). */
  note?: string
  /** To'lovchi tomonni almashtirish. `null` = korporativ hisobdan uzish (mehmon o'zi to'laydi).
      Server buni MOLIYAVIY amal deb biladi — `payments.record` ruxsati kerak. */
  organizationId?: string | null
  orgRef?: string
}

export const updateBooking = (id: string, body: UpdateBookingBody) =>
  api<Booking>(`/bookings/${id}`, { method: "PATCH", body })

// ── Bo'lish (mehmon o'rtada boshqa xonaga ko'chadi) ──────────────────────────
//
// `PATCH { roomId }` dan FARQI: u butun yashashni ko'chiradi va o'tgan kechalar qayerda
// o'tgani tarixdan o'chadi. Bo'lishda birinchi qism o'z xonasida o'z kunlari bilan qoladi,
// faqat ikkinchisi yangi xonaga tushadi. Server buni BITTA tranzaksiyada bajaradi: xona band
// bo'lsa 409 qaytadi va hech narsa o'zgarmaydi.

export type SplitBookingBody = {
  /** Ko'chish kuni: birinchi qism shu kuni tugaydi (exclusive), ikkinchisi shu kuni boshlanadi.
      Yashash ichida QAT'IY bo'lishi shart (kirish < bo'linish < chiqish). */
  splitDate: string
  /** Mehmon ko'chadigan xona — joriysidan boshqa. */
  roomId: string
  /** Ikkinchi qism summasi; berilmasa server kechalar bo'yicha proporsional taqsimlaydi. */
  totalAmount?: number
}

/** Ikkala qism ham qaytadi — panel kalendarni kutmasdan natijani ko'rsata oladi. */
export const splitBooking = (id: string, body: SplitBookingBody) =>
  api<{ first: Booking; second: Booking }>(`/bookings/${id}/split`, { method: "POST", body })

// ── Hisob-faktura ────────────────────────────────────────────────────────────
//
// Hujjat serverda SAQLANADI, chunki undagi RAQAM mehmon qo'lidagi qog'ozda qoladi: u hujjatni
// ish joyiga topshiradi va qayta so'raganda aynan o'sha raqam chiqishi kerak. Shu sabab
// `issueInvoice` IDEMPOTENT — ikkinchi chaqiruv yangi raqam ajratmaydi.

export type Invoice = {
  id: string
  /** Mehmonxona ichida ketma-ket raqam (global emas). */
  number: number
  issuedAt: string
  issuedBy: { id: string; name: string } | null
  /** Hujjat BERILGAN LAHZADAGI summalar (butun zanjir bo'yicha) — keyingi tahrir eski
      qog'ozni yolg'onga aylantirmasin. Decimal → string/number bo'lib kelishi mumkin. */
  totalAmount: number | string
  paidAmount: number | string
}

/** Hujjat + u qamragan bronlar (bo'lingan yashashda bir nechta, kirish sanasi bo'yicha). */
export type InvoiceView = { invoice: Invoice | null; bookings: Booking[] }

/** Berilgan hujjat (bo'lsa) — yangi raqam ajratmaydi. */
export const getInvoice = (bookingId: string) => api<InvoiceView>(`/bookings/${bookingId}/invoice`)

/** Hujjatni beradi yoki mavjudini qaytaradi (idempotent). */
export const issueInvoice = (bookingId: string) =>
  api<InvoiceView & { invoice: Invoice }>(`/bookings/${bookingId}/invoice`, { method: "POST" })

// PATCH bodyless — api() content-type qo'ymaydi (Fastify bo'sh-body gotcha).
export const checkInBooking = (id: string) => api<Booking>(`/bookings/${id}/check-in`, { method: "PATCH" })
export const checkOutBooking = (id: string) => api<Booking>(`/bookings/${id}/check-out`, { method: "PATCH" })
export const cancelBooking = (id: string) => api<Booking>(`/bookings/${id}/cancel`, { method: "PATCH" })

// ── To'lov ledgeri ───────────────────────────────────────────────────────────
// `payments.record` ruxsati bilan. Yozuvlar o'chirilmaydi — faqat storno (sabab majburiy);
// resepshn O'Z yozuvini 15 daqiqa ichida storno qila oladi, keyin menejer/rahbar kerak.

/** `eventId` — idempotentlik kaliti: forma OCHILGANDA bir marta yaratiladi
    (`crypto.randomUUID()`), har qayta urinishda O'SHA qiymat yuboriladi va faqat
    muvaffaqiyatdan keyin yangilanadi. Server bir xil kalitni ikkinchi marta ko'rsa yangi
    ledger qatori yozmaydi — ikki bosish/qayta yuborish dubl to'lov bermaydi. */
export const recordBookingPayment = (
  bookingId: string,
  body: { amount: number; method: RecordableMethod; note?: string; eventId: string },
) => api<Booking>(`/bookings/${bookingId}/payments`, { method: "POST", body })

/** NAQD qator stornosida `cashReturned` MAJBURIY savol: pul mehmonga jismonan qaytdimi (true)
    yoki xato yozuv — pul kassada qoldi/kirmagan (false)? Server taxmin qilmaydi (aks holda 400
    CASH_RETURN_UNSPECIFIED) — noto'g'ri default smena naqd hisobotini jimgina buzadi.
    Karta/o'tkazmada e'tiborga olinmaydi. */
export const voidBookingPayment = (
  bookingId: string,
  paymentId: string,
  body: { reason: string; cashReturned?: boolean },
) =>
  api<Booking>(`/bookings/${bookingId}/payments/${paymentId}/void`, {
    method: "POST",
    body,
  })

// ── Smena (g'aladon) sessiyasi ───────────────────────────────────────────────
// SHIFT-DESIGN.md: hisob birligi JISMONIY G'ALADON — mehmonxonada bir vaqtda bitta ochiq
// sessiya; egasi javobgar, pul kim qo'lidan o'tgani `payments.receivedBy`da. Server smenani
// hech qachon o'zi yopmaydi. Naqd guard (SHIFT_REQUIRED) server tomonda — panel qulaylik qatlami.

export type ShiftSessionStatus = "open" | "closed"
/** self = egasi yakunladi; handover = keyingi kassir qabul qilib oldi; forced = menejer. */
export type ShiftCloseReason = "self" | "handover" | "forced"
export type CashMovementKind = "deposit" | "withdrawal" | "refund"

export type ShiftSession = {
  id: string
  status: ShiftSessionStatus
  user: { id: string; name: string; role: string }
  openedAt: string
  closedAt: string | null
  closeReason: ShiftCloseReason | null
  closedBy: { id: string; name: string } | null
  /** 0=norma, 1=24h, 2=48h, 3=72h — "ochiq qolib ketdi" zinasi (faqat xabar). */
  escalationLevel: number
  note: string | null
  shiftId: string | null
}

export type ShiftTotals = {
  byMethod: Record<string, { amount: number; count: number }>
  voidedCount: number
  movementNet: number
  movementCount: number
}

/** `session` — mehmonxonaning FAOL sessiyasi (meniki bo'lmasligi ham mumkin — g'aladon modeli). */
export type ShiftCurrent = {
  session: ShiftSession | null
  totals: ShiftTotals | null
  lastClosed: ShiftSession | null
}

/** Query kalitlari bitta fabrikada (chat naqshi) — invalidateQueries({queryKey: shiftKeys.all}) hammasini supuradi. */
export const shiftKeys = {
  all: ["shift-session"] as const,
  current: ["shift-session", "current"] as const,
  list: (cursor?: string) => ["shift-session", "list", cursor ?? ""] as const,
  report: (id: string) => ["shift-session", "report", id] as const,
}

export const getCurrentShift = () => api<ShiftCurrent>("/shift-sessions/current")

/** Ochishda PUL YUBORILMAYDI: smena sessiyasi — javobgarlik oynasi, kassa apparati emas.
    `expectTakeover` — faol sessiya boshqa xodimniki bo'lsa: ochilishim uni handover bilan
    yopadi va yangisini ochadi (bitta atomik amal — qog'oz topshiruvining o'zi). */
export const openShiftSession = (body: {
  note?: string
  prevNoteAck?: boolean
  expectTakeover?: boolean
}) => api<ShiftCurrent>("/shift-sessions/open", { method: "POST", body })

/** Yakunlash so'rovida PUL YO'Q: xodim hech nima sanamaydi va kiritmaydi — smena to'lovlari
    allaqachon yozilgan, natija AVTOMATIK hisobot bo'lib qaytadi (izoh — ixtiyoriy). */
export const closeShiftSession = (id: string, body: { note?: string }) =>
  api<ShiftSession>(`/shift-sessions/${id}/close`, { method: "POST", body })

export const recordCashMovement = (
  id: string,
  body: { kind: CashMovementKind; amount: number; reason: string; bookingId?: string; eventId: string },
) => api<{ sessionId: string; totals: ShiftTotals }>(`/shift-sessions/${id}/movements`, { method: "POST", body })

export const listShiftSessions = (cursor?: string) => {
  const qs = new URLSearchParams()
  if (cursor) qs.set("cursor", cursor)
  const q = qs.toString()
  return api<{ items: ShiftSession[]; nextCursor: string | null }>(`/shift-sessions${q ? `?${q}` : ""}`)
}

export type ShiftReport = {
  session: ShiftSession
  cash: {
    byMethod: Record<string, { amount: number; count: number }>
    byHands: Array<{ user: { id: string; name: string } | null; total: number; count: number }>
    voided: { count: number; amount: number }
    postCloseVoids: { count: number; amount: number }
    voidedHere: { count: number; amount: number }
    movements: Array<{
      id: string
      kind: CashMovementKind
      amount: number
      reason: string
      bookingId: string | null
      createdAt: string
      createdBy: { id: string; name: string } | null
    }>
  }
  sheet: ShiftSheet
  health: Array<{ action: string; label: string; count: number; severity: string }>
  flags: string[]
}

export type ShiftSheet = {
  rooms: Array<{
    roomNumber: string
    guestName: string | null
    checkInDate: string | null
    checkInTime: string | null
    checkOutDate: string | null
    nights: number | null
    people: number | null
    price: number | null
    charged: number | null
    paid: number | null
    debtPaid: number | null
    debt: number | null
    company: string | null
  }>
  events: Array<{
    id: string
    at: string
    atText: string
    kind: "check_in" | "check_out" | "payment" | "expense"
    roomNumber: string
    guestName: string
    checkInDate: string | null
    checkInTime: string | null
    checkOutDate: string | null
    amount: number
    method: string | null
    reason: string | null
    approvedBy: string | null
  }>
  totals: {
    roomsTotal: number
    roomsOccupied: number
    roomsFree: number
    occupancyPct: number
    people: number
    checkIns: number
    checkOuts: number
    price: number
    charged: number
    paid: number
    debtPaid: number
    debt: number
    cash: number
    card: number
    transfer: number
    income: number
    expense: number
  }
}

export const getShiftReport = (id: string) => api<ShiftReport>(`/shift-sessions/${id}/report`)

/** Smena xronologiyasi — hujjatning "Tizim jurnali" bo'limi. ALOHIDA so'rov: jurnal
    standart holatda CHIZILMAYDI (qo'shimcha varaq yeydi), ya'ni kalit yoqilmaguncha uni
    tortib olishning hojati yo'q. `activity.view` ruxsatini talab qiladi. */
export type ShiftTimelineItem = {
  id: string
  action: string
  label: string
  severity: string
  actorName: string | null
  entityType: string | null
  entityId: string | null
  at: string
  data?: unknown
}

export const getShiftTimeline = (id: string) =>
  api<{ sessionId: string; items: ShiftTimelineItem[] }>(`/shift-sessions/${id}/timeline`)

// ── Tashkilotlar (korporativ mijozlar) ───────────────────────────────────────
//
// "Kompaniya hisobiga" yashash: kompaniya xodimi kelib resepshnda PUL BERMAYDI, bron esa
// kalendarda oddiy bron kabi turadi; hisob oy oxirida tashkilotga yoziladi.
//
// Resepshnda bu ro'yxat FAQAT O'QISH uchun: shartnoma, chegirma va qarz shifti rahbar/menejer
// panelida belgilanadi (`organizations.manage`). Bu yerda ular ko'rsatiladi — xodim kimni
// tanlayotganini va kompaniyaning qarzi qanchaligini bilishi kerak, lekin o'zgartira olmaydi.

export type OrganizationStatus = "active" | "blocked" | "archived"

export type Organization = {
  id: string
  name: string
  shortName: string | null
  inn: string | null
  contactName: string | null
  contactPhone: string | null
  contractNumber: string | null
  /** Shartnoma tugash sanasi (ISO) — tugagan/tugayotgan shartnoma ogohlantirishi shundan. */
  contractTo: string | null
  /** Rack rate'dan chegirma foizi — korporativ tarif AYNAN shundan chiqadi (Decimal → string). */
  discountPercent: string | number | null
  /** Kelishilgan qarz shifti. Oshsa resepshn OGOHLANTIRILADI, bron bloklanmaydi. */
  creditLimit: string | number | null
  paymentTermDays: number | null
  status: OrganizationStatus
  note: string | null
  /** Tashkilot hisobiga yozilgan summa. */
  charged: number
  /** Kompaniya to'lagani. */
  settled: number
  /** charged − settled. Musbat = kompaniya qarzdor. */
  balance: number
  bookingCount: number
}

/** Faqat FAOL shartnomalar: bloklangan/arxivdagiga baribir bron ochilmaydi (server 409 beradi),
    ro'yxatda ko'rsatish esa xodimni bekorga adashtirardi. */
export const listOrganizations = () => api<Organization[]>("/organizations?status=active")

/** Bron faoliyat tarixi (kim ochdi, kim kiritdi, pul qanday o'zgardi) — detal timeline'i. */
export type BookingActivity = {
  id: string
  action: string
  data: Record<string, unknown> | null
  createdAt: string
  actor: { id: string; name: string } | null
}

export const getBookingActivity = (id: string) => api<BookingActivity[]>(`/bookings/${id}/activity`)

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

/** `scope=active` (sukut) — faqat joylashgan/kutilayotgan odamlar. `archive` — chiqib
    ketganlar, qidiruv SERVER tomonda. Sahifa ochilishida butun tarix ko'tarilmasin. */
export const listGuests = (scope: "active" | "archive" = "active", search?: string) => {
  const q = new URLSearchParams({ scope })
  if (search) q.set("search", search)
  return api<DirectoryGuest[]>(`/guests?${q}`)
}

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

/** `limit` — server sukut bo'yicha 100 qator beradi (30 kunlik oyna). Doska bitta so'rovda
    uchala ustunni to'ldiradi, shuning uchun undan ko'proq so'raydi; DTO shifti 200. */
export const listServiceRequests = (params?: {
  status?: ServiceRequestStatus
  from?: string
  limit?: number
}) => {
  const q = new URLSearchParams()
  if (params?.status) q.set("status", params.status)
  if (params?.from) q.set("from", params.from)
  if (params?.limit) q.set("limit", String(params.limit))
  const query = q.toString()
  return api<ServiceRequest[]>(`/service-requests${query ? `?${query}` : ""}`)
}

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

// ── Housekeeping otcheti (GET /housekeeping/report, lost-items) ───────────────

export type HkSessionStatus = "in_progress" | "done" | "cancelled"

/** Bitta tozalash seansi — kim, qaysi xonani, qachondan qachongacha. */
export type HkReportSession = {
  id: string
  roomNumber: string
  floor: number | null
  cleaner: string
  status: HkSessionStatus
  /** Qanday yopilgan: staff / reception / auto_expired (unutilgan seans). */
  endReason: string | null
  startedAt: string
  finishedAt: string | null
  minutes: number | null
  /** Nisbiy URL'lar (`/files/hk/…`) — ko'rsatishda `hkFileUrl` bilan to'ldiriladi. */
  photos: string[]
}

export type HkLostItem = {
  id: string
  roomNumber: string
  itemName: string
  place: string
  photoUrl: string | null
  reportedBy: string
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

export type HkReport = {
  range: { from: string; to: string }
  summary: {
    done: number
    cancelled: number
    /** Sana filtridan MUSTAQIL: hozir nechta xona tozalanmoqda. */
    activeNow: number
    avgMinutes: number | null
    byCleaner: Array<{ userId: string; name: string; done: number; avgMinutes: number | null }>
  }
  sessions: HkReportSession[]
  lostItems: HkLostItem[]
}

/** Sana chegaralari YYYY-MM-DD, mehmonxona zonasida talqin qilinadi (server). */
export const getHousekeepingReport = (from?: string, to?: string) => {
  const q = new URLSearchParams()
  if (from) q.set("from", from)
  if (to) q.set("to", to)
  const qs = q.toString()
  return api<HkReport>(`/housekeeping/report${qs ? `?${qs}` : ""}`)
}

export const resolveLostItem = (id: string) =>
  api<HkLostItem>(`/housekeeping/lost-items/${id}/resolve`, { method: "PATCH" })

/** Rasm fayllari autensiz alohida route'da yashaydi — URL'ni API bazasiga ulaymiz. */
export const hkFileUrl = (path: string) => `${BASE_URL}${path}`

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
  /** Tozalash davomiyligi (daqiqa) — kalendar checkout bron oxiridagi tozalash belgisining
      kengligini shundan oladi. Yo'q bo'lsa 30. */
  cleaningMinutes?: number | null
}

/** Kirgan xodim biriktirilgan mehmonxonaning panel brendi + qoidalari (GET /hotel).
    `longLogoUrl` yo'q bo'lsa (yoki hali yuklanmagan) panel Safora logotipiga tushadi. */
// ── Ruhsatlar (GET/PUT /permissions) ─────────────────────────────────────────

/** Rahbar siyosat yozadigan rollar. `owner` ATAYLAB yo'q — uning ruxsati roldan keladi. */
export type PolicyRole = "manager" | "reception"

export type PermissionDef = {
  key: string
  label: string
  hint: string
  group: string
  roles: PolicyRole[]
  /** Yoqilishi uchun avval kerak bo'ladigan ruhsat. */
  requires: string | null
}

export type PermissionCatalog = {
  groups: Array<{ id: string; label: string; hint: string }>
  permissions: PermissionDef[]
  policies: Record<PolicyRole, string[]>
}

export const getMyPermissions = () => api<{ role: string; granted: string[] }>("/permissions/me")

// ── Web push (FCM qurilma tokeni) ────────────────────────────────────────────

export const registerPushToken = (token: string) =>
  api<{ ok: true }>("/push/token", { method: "POST", body: { token, platform: "web" } })

export const removePushToken = (token: string) =>
  api<{ ok: true }>("/push/token", { method: "DELETE", body: { token } })

/** Hisob-faktura shapkasiga chiqadigan rekvizitlar.

    `address`/`phone` — ADMIN yuritadi (mehmonxona kartochkasi). `inn`/`vatRate` — mehmonxona
    egasi kiritadi (owner/manager paneli). Resepshn hammasini faqat O'QIYDI: hujjat shapkasi
    buxgalteriya qarori, front-desk uni o'zgartirmaydi.

    Har biri `null` bo'la oladi va hujjat to'ldirilmagan qatorni UMUMAN chizmaydi — bo'sh
    "STIR: —" satri buxgalterga hech narsa bermaydi. */
export type HotelRequisites = {
  address: string | null
  phone: string | null
  /** STIR — soliq to'lovchi raqami. */
  inn: string | null
  /** QQS stavkasi FOIZda (12 = 12%). `null` = QQS to'lovchisi emas → hujjatda QQS bloki yo'q. */
  vatRate: number | null
  /** ISO 4217 (amalda "UZS"). */
  currency: string
}

export type HotelBranding = {
  name: string
  logoUrl: string | null
  longLogoUrl: string | null
  /** Mehmonxona qoidalari; ixtiyoriy (backend bosqichma-bosqich to'ldiradi). */
  policy?: HotelPolicy | null
  /** Hujjat rekvizitlari; ixtiyoriy (eski javobda bo'lmasligi mumkin). */
  requisites?: HotelRequisites | null
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
  archived: boolean
}

export type ChatMessage = {
  id: string
  bookingId: string
  senderType: ChatSender
  /** staff xabari — javob bergan xodim id'si; mehmon xabari — null. */
  senderUserId: string | null
  text: string
  createdAt: string
  replyTo?: { id: string; text: string; senderType: "guest" | "staff" } | null
  reactions?: ReactionView[]
}

/** Keyset sahifa: items yangi→eski tartibda; nextCursor = eskiroq sahifa uchun (yoki null). */
export type ChatPage<T> = { items: T[]; nextCursor: string | null }

export const listConversations = () => api<ChatPage<ChatConversation>>("/chat/conversations")

export const listChatMessages = (bookingId: string, cursor?: string) => {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
  return api<ChatPage<ChatMessage>>(`/chat/conversations/${bookingId}/messages${qs}`)
}

export const sendChatMessage = (bookingId: string, text: string, replyToId?: string) =>
  api<ChatMessage>(`/chat/conversations/${bookingId}/messages`, {
    method: "POST",
    body: { text, ...(replyToId ? { replyToId } : {}) },
  })

// POST bodyless — api() content-type qo'ymaydi (Fastify bo'sh-body gotcha).
export const markChatRead = (bookingId: string) =>
  api<{ ok: true }>(`/chat/conversations/${bookingId}/read`, { method: "POST" })

/** Real-time: connection token + WS URL (Centrifugo). Reception connect'da o'z inbox'iga avto-obuna. */
export const chatRtConnect = () =>
  api<{ token: string; url: string }>("/chat/rt/connect", { method: "POST" })

/** Bitta suhbat kanaliga subscription token — server tenant/booking'ni tekshiradi (begonaga 403). */
export const chatRtSubscribe = (channel: string) =>
  api<{ token: string }>("/chat/rt/subscribe", { method: "POST", body: { channel } })

/** `remember: false` — "Vaqtinchalik sessiya": server seans cookie'sini muddatsiz yozadi va u
    brauzer yopilishi bilan o'chadi. Tanlov endi SERVERDA amalga oshadi (cookie muddatini o'sha
    yozadi), shuning uchun login so'roviga qo'shiladi. */
export function staffLogin(
  staffHandle: string,
  password: string,
  turnstileToken: string | null,
  remember: boolean,
): Promise<Session> {
  // `panel` — bu reception paneli: backend faqat role=reception hisobiga sessiya beradi,
  // owner/manager o'z paneliga yo'naltiriladi (403 + havola).
  return api<Session>("/auth/login", {
    method: "POST",
    body: {
      staffHandle,
      password,
      panel: "reception",
      remember,
      ...(turnstileToken ? { turnstileToken } : {}),
    },
  })
}

/**
 * Tiklash havolasini so'rash. Javob ATAYIN noaniq: hisob bor-yo'qligi oshkor qilinmaydi
 * (aks holda bu forma "qaysi login mavjud" degan tekshirgichga aylanardi). Yagona istisno —
 * emailsiz hisob: bu holatda xodim kutib o'tirmasin deb ochiq aytiladi.
 *
 * Backend `TurnstileGuard` bilan himoyalangan: usiz bu endpoint istalgan manzilga xat
 * yog'diradigan dastak bo'lardi.
 */
export function requestPasswordReset(
  identifier: string,
  turnstileToken: string | null,
): Promise<{ ok: true; message: string }> {
  return api<{ ok: true; message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { identifier, ...(turnstileToken ? { turnstileToken } : {}) },
  })
}

/** Havoladagi token bilan yangi parol qo'yish. Token bir martalik va muddatli. */
export function resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
  return api<{ ok: true }>("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  })
}

/** O'z parolini almashtirish — eski parol bilan. Boshqa barcha seanslar yopiladi. */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return api<{ ok: true }>("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
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

// ── Jamoa chati (GET/POST /chat/team) ────────────────────────────────────────

export type TeamThread = {
  user: { id: string; name: string; role: string; avatarUrl?: string | null }
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastMessageMine: boolean
  unread: number
  archived: boolean
}

export type TeamMessage = {
  id: string
  senderId: string
  text: string
  createdAt: string
  replyTo?: { id: string; text: string; senderId: string } | null
  reactions?: ReactionView[]
}

export const listTeamThreads = () => api<TeamThread[]>("/chat/team/threads")
export const listTeamMessages = (userId: string, before?: string) =>
  api<{ messages: TeamMessage[] }>(
    `/chat/team/threads/${userId}/messages${before ? `?before=${before}` : ""}`,
  )
export const sendTeamMessage = (userId: string, text: string, replyToId?: string) =>
  api<TeamMessage>(`/chat/team/threads/${userId}/messages`, {
    method: "POST",
    body: { text, ...(replyToId ? { replyToId } : {}) },
  })
export const markTeamRead = (userId: string) =>
  api<{ ok: boolean }>(`/chat/team/threads/${userId}/read`, { method: "POST" })
export const getTeamUnread = () => api<{ unread: number }>("/chat/team/unread")

export type ReactionView = { emoji: string; count: number; mine: boolean }

export const reactTeamMessage = (messageId: string, emoji: string | null) =>
  api<{ messageId: string; reactions: ReactionView[] }>(`/chat/team/messages/${messageId}/react`, {
    method: "POST",
    body: emoji ? { emoji } : {},
  })

export const reactGuestMessage = (messageId: string, emoji: string | null) =>
  api<{ messageId: string; reactions: ReactionView[] }>(`/chat/messages/${messageId}/react`, {
    method: "POST",
    body: emoji ? { emoji } : {},
  })

export const archiveTeamThread = (userId: string, archived: boolean) =>
  api<{ ok: boolean; archived: boolean }>(`/chat/team/threads/${userId}/archive`, {
    method: "POST",
    body: { archived },
  })

export const archiveConversation = (bookingId: string, archived: boolean) =>
  api<{ ok: boolean; archived: boolean }>(`/chat/conversations/${bookingId}/archive`, {
    method: "POST",
    body: { archived },
  })

// ── Jamoa guruhi (GET/POST /chat/group) ──────────────────────────────────────

export type GroupMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: string
  replyTo?: { id: string; text: string; senderName: string } | null
  reactions?: ReactionView[]
}

export const listGroupMessages = (before?: string) =>
  api<{ messages: GroupMessage[] }>(`/chat/group/messages${before ? `?before=${before}` : ""}`)
export const sendGroupMessage = (text: string, replyToId?: string) =>
  api<GroupMessage>("/chat/group/messages", {
    method: "POST",
    body: { text, ...(replyToId ? { replyToId } : {}) },
  })
export const markGroupRead = () => api<{ ok: boolean }>("/chat/group/read", { method: "POST" })
export const getGroupUnread = () => api<{ unread: number }>("/chat/group/unread")
export const reactGroupMessage = (messageId: string, emoji: string | null) =>
  api<{ messageId: string; reactions: ReactionView[] }>(`/chat/group/messages/${messageId}/react`, {
    method: "POST",
    body: emoji ? { emoji } : {},
  })

// ── Housekeeping yozishmasi (GET/POST /chat/housekeeping) ────────────────────
//
// Jamoa guruhidan AJRATILGAN xona: alohida jadval, a'zolik esa ruhsat kaliti emas, ROL ro'yxati
// (`owner`, `manager`, `reception`, `housekeeper` — backendda `HK_CHAT_ROLES`). Sabab: tozalash
// xodimiga `can()` har ruhsat kalitiga `false` qaytaradi, ya'ni kalitga bog'lansa u o'z chatidan
// quvilardi. Panel tomonda ham shuning uchun `can(...)` bilan yashirilmaydi — rol yetarli.
//
// Guruh chatidan farqi: `replyTo` ham, reaksiya ham YO'Q (mobil ilova ularni ko'rsatmaydi).

export type HkChatMessage = {
  id: string
  senderId: string
  senderName: string
  senderAvatarUrl: string | null
  text: string
  createdAt: string
}

/** Javob eskidan yangiga. `before` — eski sahifani yuklash uchun `messages[0].id`. */
export const listHkMessages = (before?: string) =>
  api<{ messages: HkChatMessage[] }>(
    `/chat/housekeeping/messages${before ? `?before=${before}` : ""}`,
  )
export const sendHkMessage = (text: string) =>
  api<HkChatMessage>("/chat/housekeeping/messages", { method: "POST", body: { text } })
export const markHkRead = () => api<{ ok: boolean }>("/chat/housekeeping/read", { method: "POST" })
export const getHkUnread = () => api<{ unread: number }>("/chat/housekeeping/unread")


export type AvatarResult = {
  avatarUrl: string | null
  remaining: number
  resetsAt: string | null
}

export const AVATAR_MAX_BYTES = 8 * 1024 * 1024

export const uploadMyAvatar = (file: File) => {
  const form = new FormData()
  form.append("file", file)
  return api<AvatarResult>("/users/me/avatar", { method: "POST", body: form, timeoutMs: 60_000 })
}

export const removeMyAvatar = () => api<AvatarResult>("/users/me/avatar", { method: "DELETE" })
