import { initPrefs, usePrefsStore, type Density, type NavSize } from "@/stores/prefs-store"

export type { Density, NavSize }

export function initUiPrefs(): void {
  initPrefs()
}

type UiPrefsValue = {
  nav: NavSize
  density: Density
  setNav: (nav: NavSize) => void
  setDensity: (density: Density) => void
  toggleNav: () => void
  aiOpen: boolean
  setAiOpen: (open: boolean) => void
}

export function useUiPrefs(): UiPrefsValue {
  const nav = usePrefsStore((s) => s.nav)
  const density = usePrefsStore((s) => s.density)
  const aiOpen = usePrefsStore((s) => s.aiOpen)
  const { setNav, setDensity, toggleNav, setAiOpen } = usePrefsStore.getState()
  return { nav, density, setNav, setDensity, toggleNav, aiOpen, setAiOpen }
}
