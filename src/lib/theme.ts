import { initPrefs, resolveTheme, usePrefsStore, type ThemePref } from "@/stores/prefs-store"

export type { ThemePref }
export { resolveTheme }

export function readThemePref(): ThemePref {
  return usePrefsStore.getState().theme
}

export function applyTheme(pref: ThemePref): void {
  usePrefsStore.getState().setTheme(pref)
}

export function initTheme(): void {
  initPrefs()
}

export function useTheme() {
  const pref = usePrefsStore((s) => s.theme)
  const { setTheme } = usePrefsStore.getState()
  return { pref, setPref: setTheme, resolved: resolveTheme(pref) }
}
