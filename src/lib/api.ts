import { clearSession, getSession, updateTokens, type Session } from "./auth"

const BASE_URL = import.meta.env.VITE_API_URL

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

type ApiOptions = {
  method?: string
  body?: unknown
  token?: string
  signal?: AbortSignal
}

async function rawFetch(path: string, { method = "GET", body, signal }: ApiOptions, token?: string) {
  const hasBody = body !== undefined
  return fetch(`${BASE_URL}${path}`, {
    method,
    // Only advertise a JSON body when we actually send one — Fastify rejects an empty
    // `application/json` body with 400, so bodyless GET/DELETE must NOT set content-type.
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    signal,
  })
}

/** Sessiya tokenini avtomatik qo'shadi; access eskirgan bo'lsa (401) bir marta refresh
    qilib qayta urinadi, refresh ham o'lgan bo'lsa sessiyani tozalab /login'ga qaytaradi. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = getSession()
  let res = await rawFetch(path, options, options.token ?? session?.accessToken)

  if (res.status === 401 && !options.token && session?.refreshToken) {
    const refreshed = await rawFetch(
      "/auth/refresh",
      { method: "POST", body: { refreshToken: session.refreshToken } },
    )
    if (refreshed.ok) {
      const next = (await refreshed.json()) as Session
      updateTokens(next.accessToken, next.refreshToken)
      res = await rawFetch(path, options, next.accessToken)
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
}

export type Booking = {
  id: string
  guestName: string
  guestPhone: string | null
  /** date-only (ISO, vaqt qismi 00:00Z) — @db.Date */
  checkInDate: string
  checkOutDate: string
  status: BookingStatus
  room: { id: string; number: string }
}

export const listRooms = () => api<Room[]>("/rooms")
export const listBookings = () => api<Booking[]>("/bookings")

export function staffLogin(staffHandle: string, password: string): Promise<Session> {
  return api<Session>("/auth/login", { method: "POST", body: { staffHandle, password } })
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
