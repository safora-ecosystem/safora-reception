import { create } from "zustand"
import type { Session } from "@/lib/auth"
import { LEFTOVER_KEYS, SESSION_KEY } from "./panel"
import { fireSessionReset } from "./reset-bus"


function readStorage(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

function writeThrough(session: Session): void {
  if (sessionStorage.getItem(SESSION_KEY) !== null) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else if (localStorage.getItem(SESSION_KEY) !== null) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
}

type SessionState = {
  session: Session | null
  save: (session: Session, temporary: boolean) => void
  updateAccessExpiry: (accessExpiresAt: number) => void
  updateAvatar: (avatarUrl: string | null) => void
  clearOnly: () => void
  reset: () => void
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  session: readStorage(),

  save: (session, temporary) => {
    const target = temporary ? sessionStorage : localStorage
    const other = temporary ? localStorage : sessionStorage
    other.removeItem(SESSION_KEY)
    target.setItem(SESSION_KEY, JSON.stringify(session))
    set({ session })
  },

  updateAccessExpiry: (accessExpiresAt) => {
    const current = get().session
    if (!current) return
    const next = { ...current, accessExpiresAt }
    writeThrough(next)
    set({ session: next })
  },

  updateAvatar: (avatarUrl) => {
    const current = get().session
    if (!current) return
    const next = { ...current, user: { ...current.user, avatarUrl } }
    writeThrough(next)
    set({ session: next })
  },

  clearOnly: () => {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(SESSION_KEY)
    set({ session: null })
  },

  reset: () => {
    get().clearOnly()
    for (const key of LEFTOVER_KEYS) localStorage.removeItem(key)
    fireSessionReset()
  },
}))

let redirected = false
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== SESSION_KEY) return
    if (e.newValue === null) {
      useSessionStore.setState({ session: null })
      if (redirected) return
      redirected = true
      window.location.assign("/login")
      return
    }
    useSessionStore.setState({ session: readStorage() })
  })
}
