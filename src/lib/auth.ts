import { useSessionStore } from "@/stores/session-store"
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

export function saveSession(session: Session, temporary: boolean): void {
  useSessionStore.getState().save(session, temporary)
}

export function getSession(): Session | null {
  return useSessionStore.getState().session
}

export function updateAccessExpiry(accessExpiresAt: number): void {
  useSessionStore.getState().updateAccessExpiry(accessExpiresAt)
}

export function updateAvatar(avatarUrl: string | null): void {
  useSessionStore.getState().updateAvatar(avatarUrl)
}

export function clearSession(): void {
  useSessionStore.getState().clearOnly()
}

export function fullSessionReset(): void {
  useSessionStore.getState().reset()
}

export function isAuthed(): boolean {
  return useSessionStore.getState().session !== null
}
