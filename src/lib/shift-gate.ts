import {
  lastKnownShiftOpen,
  rememberShiftOpen,
  useShiftStore,
} from "@/stores/shift-store"

export { lastKnownShiftOpen, rememberShiftOpen }

export function holdShiftGate(value: boolean): void {
  useShiftStore.getState().hold(value)
}

export function useShiftGateHeld(): boolean {
  return useShiftStore((s) => s.held)
}

export function startLogoutCountdown(): void {
  useShiftStore.getState().startLogoutCountdown()
}

export function useLogoutCountdownPending(): boolean {
  return useShiftStore((s) => s.logoutPending)
}
