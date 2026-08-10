import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"


export type NavSize = "rail" | "cozy" | "wide"
export type Density = "compact" | "cozy" | "roomy"

type Prefs = { nav: NavSize; density: Density }

const KEY = "safora_ui"
const DEFAULTS: Prefs = { nav: "cozy", density: "cozy" }

function read(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>
    return {
      nav: raw.nav === "rail" || raw.nav === "wide" || raw.nav === "cozy" ? raw.nav : DEFAULTS.nav,
      density:
        raw.density === "compact" || raw.density === "roomy" || raw.density === "cozy"
          ? raw.density
          : DEFAULTS.density,
    }
  } catch {
    return DEFAULTS
  }
}

function apply(prefs: Prefs): void {
  const root = document.documentElement
  root.dataset.nav = prefs.nav
  root.dataset.density = prefs.density
}

export function initUiPrefs(): void {
  apply(read())
}

type UiPrefsValue = Prefs & {
  setNav: (nav: NavSize) => void
  setDensity: (density: Density) => void
  toggleNav: () => void
  aiOpen: boolean
  setAiOpen: (open: boolean) => void
}

const UiPrefsContext = createContext<UiPrefsValue | null>(null)

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(read)
  const [aiOpen, setAiOpen] = useState(false)
  const [lastOpen, setLastOpen] = useState<Exclude<NavSize, "rail">>(() =>
    read().nav === "wide" ? "wide" : "cozy",
  )

  useEffect(() => {
    apply(prefs)
    localStorage.setItem(KEY, JSON.stringify(prefs))
  }, [prefs])

  const setNav = useCallback((nav: NavSize) => {
    if (nav !== "rail") setLastOpen(nav)
    setPrefs((prev) => ({ ...prev, nav }))
  }, [])

  const setDensity = useCallback((density: Density) => {
    setPrefs((prev) => ({ ...prev, density }))
  }, [])

  const toggleNav = useCallback(() => {
    setPrefs((prev) => ({ ...prev, nav: prev.nav === "rail" ? lastOpen : "rail" }))
  }, [lastOpen])

  const value = useMemo(
    () => ({ ...prefs, setNav, setDensity, toggleNav, aiOpen, setAiOpen }),
    [prefs, setNav, setDensity, toggleNav, aiOpen],
  )

  return <UiPrefsContext.Provider value={value}>{children}</UiPrefsContext.Provider>
}

export function useUiPrefs(): UiPrefsValue {
  const ctx = useContext(UiPrefsContext)
  if (!ctx) throw new Error("useUiPrefs UiPrefsProvider ichida ishlatilishi kerak")
  return ctx
}
