import { create } from "zustand"
import { persist } from "zustand/middleware"
import { readKey } from "@/lib/safe-storage"
import { PREFS_KEY } from "./panel"


export type ThemePref = "auto" | "light" | "dark"
export type NavSize = "rail" | "cozy" | "wide"
export type Density = "compact" | "cozy" | "roomy"

type PersistedPrefs = {
  theme: ThemePref
  nav: NavSize
  density: Density
  lastOpen: Exclude<NavSize, "rail">
}

type PrefsState = PersistedPrefs & {
  aiOpen: boolean
  setTheme: (theme: ThemePref) => void
  setNav: (nav: NavSize) => void
  setDensity: (density: Density) => void
  toggleNav: () => void
  setAiOpen: (open: boolean) => void
}

const DEFAULTS: PersistedPrefs = { theme: "auto", nav: "cozy", density: "cozy", lastOpen: "cozy" }

function systemIsDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  return pref === "auto" ? (systemIsDark() ? "dark" : "light") : pref
}

function applyDom(prefs: Pick<PersistedPrefs, "theme" | "nav" | "density">): void {
  const root = document.documentElement
  root.dataset.theme = resolveTheme(prefs.theme)
  root.dataset.nav = prefs.nav
  root.dataset.density = prefs.density
}

function sanitizePersisted(raw: unknown): PersistedPrefs {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>
  const theme =
    r.theme === "light" || r.theme === "dark" || r.theme === "auto" ? r.theme : DEFAULTS.theme
  const nav =
    r.nav === "rail" || r.nav === "cozy" || r.nav === "wide" ? r.nav : DEFAULTS.nav
  const density =
    r.density === "compact" || r.density === "cozy" || r.density === "roomy"
      ? r.density
      : DEFAULTS.density
  const lastOpen = r.lastOpen === "wide" || r.lastOpen === "cozy" ? r.lastOpen : DEFAULTS.lastOpen
  return { theme, nav, density, lastOpen }
}

function readLegacy(): PersistedPrefs {
  const out = { ...DEFAULTS }
  const theme = readKey("local", "safora_theme")
  if (theme === "light" || theme === "dark" || theme === "auto") out.theme = theme
  try {
    const ui = JSON.parse(readKey("local", "safora_ui") ?? "{}") as {
      nav?: unknown
      density?: unknown
    }
    if (ui.nav === "rail" || ui.nav === "cozy" || ui.nav === "wide") out.nav = ui.nav
    if (ui.density === "compact" || ui.density === "cozy" || ui.density === "roomy")
      out.density = ui.density
  } catch {
  }
  out.lastOpen = out.nav === "wide" ? "wide" : "cozy"
  return out
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      aiOpen: false,
      setTheme: (theme) => set({ theme }),
      setNav: (nav) => set(nav === "rail" ? { nav } : { nav, lastOpen: nav }),
      setDensity: (density) => set({ density }),
      toggleNav: () => {
        const { nav, lastOpen } = get()
        set({ nav: nav === "rail" ? lastOpen : "rail" })
      },
      setAiOpen: (aiOpen) => set({ aiOpen }),
    }),
    {
      name: PREFS_KEY,
      version: 1,
      partialize: (s) => ({ theme: s.theme, nav: s.nav, density: s.density, lastOpen: s.lastOpen }),
      migrate: (persisted) => persisted as PersistedPrefs,
      merge: (persisted, current) => ({
        ...current,
        ...(persisted ? sanitizePersisted(persisted) : readLegacy()),
      }),
    },
  ),
)

export function initPrefs(): void {
  applyDom(usePrefsStore.getState())
}

if (typeof window !== "undefined") {
  usePrefsStore.subscribe((s) => applyDom(s))
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (usePrefsStore.getState().theme === "auto") applyDom(usePrefsStore.getState())
    })
}
