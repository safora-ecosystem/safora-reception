import { create } from "zustand"
import type { Session } from "@/lib/auth"
import { readKey, removeKey, writeKey } from "@/lib/safe-storage"
import { LEFTOVER_KEYS, SESSION_KEY } from "./panel"
import { fireSessionReset } from "./reset-bus"


function readStorage(): Session | null {
  const raw = readKey("session", SESSION_KEY) ?? readKey("local", SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    removeKey("session", SESSION_KEY)
    removeKey("local", SESSION_KEY)
    return null
  }
}

function writeThrough(session: Session): void {
  if (readKey("session", SESSION_KEY) !== null) {
    writeKey("session", SESSION_KEY, JSON.stringify(session))
  } else if (readKey("local", SESSION_KEY) !== null) {
    writeKey("local", SESSION_KEY, JSON.stringify(session))
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
    const target = temporary ? "session" : "local"
    const other = temporary ? "local" : "session"
    removeKey(other, SESSION_KEY)
    writeKey(target, SESSION_KEY, JSON.stringify(session))
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
    removeKey("session", SESSION_KEY)
    removeKey("local", SESSION_KEY)
    set({ session: null })
  },

  reset: () => {
    get().clearOnly()
    for (const key of LEFTOVER_KEYS) removeKey("local", key)
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
