import { create } from "zustand"
import { onSessionReset } from "./reset-bus"


type ShiftState = {
  held: boolean
  logoutPending: boolean
  hold: (value: boolean) => void
  startLogoutCountdown: () => void
}

export const useShiftStore = create<ShiftState>()((set) => ({
  held: false,
  logoutPending: false,
  hold: (held) => set({ held }),
  startLogoutCountdown: () => set({ logoutPending: true }),
}))

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

if (typeof window !== "undefined") {
  onSessionReset(() => useShiftStore.setState({ held: false, logoutPending: false }))
}
