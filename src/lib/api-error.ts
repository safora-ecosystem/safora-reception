import { ApiError, NetworkError, apiErrorText } from "./api"
import type { TFunc } from "./i18n"

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
  retryable: boolean
  status?: number
  serverMessage?: string
}

const offline = (): boolean => typeof navigator !== "undefined" && !navigator.onLine

function isAbortLike(cause: unknown): boolean {
  return cause instanceof DOMException && (cause.name === "TimeoutError" || cause.name === "AbortError")
}

export function classifyApiError(err: unknown): ApiErrorInfo {
  if (err instanceof ApiError) {
    const status = err.status
    if (status === 401) return { kind: "auth", retryable: false, status }
    if (status === 403) return { kind: "forbidden", retryable: false, status }
    if (status === 404) return { kind: "notfound", retryable: false, status }
    if (status === 429) return { kind: "ratelimit", retryable: true, status }
    if (status >= 500) return { kind: "server", retryable: true, status }
    return { kind: "client", retryable: false, status, serverMessage: apiErrorText(err, "") }
  }

  if (err instanceof NetworkError) {
    if (isAbortLike(err.cause)) return { kind: "timeout", retryable: true }
    if (offline()) return { kind: "offline", retryable: true }
    return { kind: "network", retryable: true }
  }

  if (err instanceof TypeError)
    return offline() ? { kind: "offline", retryable: true } : { kind: "network", retryable: true }
  if (isAbortLike(err)) return { kind: "timeout", retryable: true }

  return { kind: "unknown", retryable: true }
}

export function describeApiError(
  info: ApiErrorInfo,
  t: TFunc,
): { title: string; description: string } {
  switch (info.kind) {
    case "auth":
      return {
        title: t("errors.sessionExpired.title"),
        description: t("errors.sessionExpired.description"),
      }
    case "forbidden":
      return { title: t("errors.forbidden.title"), description: t("errors.forbidden.description") }
    case "notfound":
      return { title: t("errors.notFound.title"), description: t("errors.notFound.description") }
    case "ratelimit":
      return { title: t("errors.rateLimit.title"), description: t("errors.rateLimit.description") }
    case "server":
      return {
        title: t("errors.server.title", { status: info.status ?? 500 }),
        description: t("errors.server.description"),
      }
    case "client":
      return {
        title: t("errors.client.title"),
        description: info.serverMessage || t("errors.client.description"),
      }
    case "timeout":
      return { title: t("errors.timeout.title"), description: t("errors.timeout.description") }
    case "offline":
      return { title: t("errors.offline.title"), description: t("errors.offline.description") }
    case "network":
      return { title: t("errors.network.title"), description: t("errors.network.description") }
    default:
      return { title: t("errors.unknown.title"), description: t("errors.unknown.description") }
  }
}

export const isRetryableApiError = (err: unknown): boolean => classifyApiError(err).retryable

export const isRateLimitError = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 429
