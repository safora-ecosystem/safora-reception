import { useSyncExternalStore } from "react"

let held = false
const subs = new Set<() => void>()

export function holdShiftGate(value: boolean): void {
  if (held === value) return
  held = value
  for (const fn of subs) fn()
}

export function useShiftGateHeld(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => held,
  )
}

const LAST_KNOWN_KEY = "safora_reception_shift_open"

export function rememberShiftOpen(open: boolean): void {
  try {
    localStorage.setItem(LAST_KNOWN_KEY, open ? "1" : "0")
  } catch {
  }
}

export function lastKnownShiftOpen(): boolean {
  try {
    return localStorage.getItem(LAST_KNOWN_KEY) === "1"
  } catch {
    return false
  }
}

let logoutPending = false

export function startLogoutCountdown(): void {
  if (logoutPending) return
  logoutPending = true
  for (const fn of subs) fn()
}

export function useLogoutCountdownPending(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => logoutPending,
  )
}
