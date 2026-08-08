import type { TKey } from "./i18n"

export type StaffRole = "owner" | "manager" | "reception" | "housekeeper"

export type StaffUser = {
  id: string
  hotelId: string
  role: StaffRole
  name: string
  staffHandle: string
  avatarUrl?: string | null
}

export const ROLE_KEY: Record<StaffRole, TKey> = {
  owner: "roles.owner",
  manager: "roles.manager",
  reception: "roles.reception",
  housekeeper: "roles.housekeeper",
}

export type Session = {
  user: StaffUser
  accessExpiresAt: number
}

const KEY = "safora_reception_session"

export function saveSession(session: Session, temporary: boolean): void {
  clearSession()
  const store = temporary ? sessionStorage : localStorage
  store.setItem(KEY, JSON.stringify(session))
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    clearSession()
    return null
  }
}

export function updateAccessExpiry(accessExpiresAt: number): void {
  const inSession = sessionStorage.getItem(KEY) !== null
  const current = getSession()
  if (!current) return
  const store = inSession ? sessionStorage : localStorage
  store.setItem(KEY, JSON.stringify({ ...current, accessExpiresAt }))
}

export function updateAvatar(avatarUrl: string | null): void {
  const inSession = sessionStorage.getItem(KEY) !== null
  const current = getSession()
  if (!current) return
  const store = inSession ? sessionStorage : localStorage
  store.setItem(KEY, JSON.stringify({ ...current, user: { ...current.user, avatarUrl } }))
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY)
  localStorage.removeItem(KEY)
}

export function isAuthed(): boolean {
  return getSession() !== null
}
