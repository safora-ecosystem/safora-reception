const BASE_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`API ${status}`)
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

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options
  const hasBody = body !== undefined

  const res = await fetch(`${BASE_URL}${path}`, {
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

  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, payload)
  return payload as T
}
