export type StaffRole = "owner" | "manager" | "reception" | "housekeeper"

export type StaffUser = {
  id: string
  hotelId: string
  role: StaffRole
  name: string
  staffHandle: string
  avatarUrl?: string | null
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: "Rahbar",
  manager: "Menejer",
  reception: "Resepshn",
  housekeeper: "Tozalash xodimi",
}

export type Session = {
  accessToken: string
  refreshToken: string
  user: StaffUser
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

export function updateTokens(accessToken: string, refreshToken: string): void {
  const inSession = sessionStorage.getItem(KEY) !== null
  const current = getSession()
  if (!current) return
  const store = inSession ? sessionStorage : localStorage
  store.setItem(KEY, JSON.stringify({ ...current, accessToken, refreshToken }))
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
