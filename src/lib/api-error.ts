import { ApiError, NetworkError, apiErrorText } from "./api"

export type ApiErrorKind =
  | "offline"
  | "network"
  | "timeout"
  | "server"
  | "ratelimit"
  | "auth"
  | "forbidden"
  | "notfound"
  | "client"
  | "unknown"

export type ApiErrorInfo = {
  kind: ApiErrorKind
  title: string
  description: string
  retryable: boolean
  status?: number
}

const offline = (): boolean => typeof navigator !== "undefined" && !navigator.onLine

function isAbortLike(cause: unknown): boolean {
  return cause instanceof DOMException && (cause.name === "TimeoutError" || cause.name === "AbortError")
}

export function classifyApiError(err: unknown): ApiErrorInfo {
  if (err instanceof ApiError) {
    const status = err.status
    if (status === 401)
      return {
        kind: "auth",
        title: "Seans muddati tugadi",
        description: "Qayta kiring — tizim login sahifasiga olib o'tadi.",
        retryable: false,
        status,
      }
    if (status === 403)
      return {
        kind: "forbidden",
        title: "Ruxsat yo'q",
        description: "Bu bo'limga kirish huquqingiz yetarli emas.",
        retryable: false,
        status,
      }
    if (status === 404)
      return {
        kind: "notfound",
        title: "Ma'lumot topilmadi",
        description: "So'ralgan ma'lumot mavjud emas yoki o'chirilgan.",
        retryable: false,
        status,
      }
    if (status === 429)
      return {
        kind: "ratelimit",
        title: "So'rovlar juda ko'p",
        description: "Biroz kutib qayta urinib ko'ring.",
        retryable: true,
        status,
      }
    if (status >= 500)
      return {
        kind: "server",
        title: `Serverda xatolik (${status})`,
        description: "Bizda texnik nosozlik — qayta urinish odatda yordam beradi.",
        retryable: true,
        status,
      }
    // Boshqa 4xx — server o'z xabarini bergan bo'lsa aynan u ko'rsatiladi (apiErrorText).
    return {
      kind: "client",
      title: "So'rov xatosi",
      description: apiErrorText(err, "So'rovni bajarib bo'lmadi."),
      retryable: false,
      status,
    }
  }

  if (err instanceof NetworkError) {
    if (isAbortLike(err.cause))
      return {
        kind: "timeout",
        title: "So'rov vaqti tugadi",
        description: "Server javob bermayapti — qayta urinib ko'ring.",
        retryable: true,
      }
    if (offline())
      return {
        kind: "offline",
        title: "Internet aloqasi yo'q",
        description: "Tarmoqqa ulanishni tekshirib qayta urinib ko'ring.",
        retryable: true,
      }
    return {
      kind: "network",
      title: "Server bilan bog'lanib bo'lmadi",
      description: "Tarmoq xatosi — birozdan so'ng qayta urinib ko'ring.",
      retryable: true,
    }
  }

  // api() dan tashqarida otilgan xom fetch xatosi (TypeError) yoki to'g'ridan-to'g'ri abort.
  if (err instanceof TypeError)
    return offline()
      ? {
          kind: "offline",
          title: "Internet aloqasi yo'q",
          description: "Tarmoqqa ulanishni tekshirib qayta urinib ko'ring.",
          retryable: true,
        }
      : {
          kind: "network",
          title: "Server bilan bog'lanib bo'lmadi",
          description: "Tarmoq xatosi — birozdan so'ng qayta urinib ko'ring.",
          retryable: true,
        }
  if (isAbortLike(err))
    return {
      kind: "timeout",
      title: "So'rov vaqti tugadi",
      description: "Server javob bermayapti — qayta urinib ko'ring.",
      retryable: true,
    }

  return {
    kind: "unknown",
    title: "Kutilmagan xatolik",
    description: "Qayta urinib ko'ring.",
    retryable: true,
  }
}

/** react-query retry siyosati uchun: FAQAT o'tkinchi xatolar qayta uriladi (4xx — yo'q). */
export const isRetryableApiError = (err: unknown): boolean => classifyApiError(err).retryable

/** 429 — qayta uriladi, lekin sekinroq (retryDelay bazasi kattaroq). */
export const isRateLimitError = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 429
