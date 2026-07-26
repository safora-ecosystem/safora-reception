import { useEffect, useState } from "react"

export type ThemePref = "auto" | "light" | "dark"

const KEY = "safora_theme"

export function readThemePref(): ThemePref {
  const raw = localStorage.getItem(KEY)
  return raw === "light" || raw === "dark" || raw === "auto" ? raw : "auto"
}

function systemIsDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  return pref === "auto" ? (systemIsDark() ? "dark" : "light") : pref
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolveTheme(pref)
}

export function initTheme(): void {
  applyTheme(readThemePref())
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readThemePref)

  useEffect(() => {
    applyTheme(pref)
    localStorage.setItem(KEY, pref)
  }, [pref])

  useEffect(() => {
    if (pref !== "auto") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("auto")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [pref])

  return { pref, setPref, resolved: resolveTheme(pref) }
}
