import { useCallback, useState } from "react"
import { DEFAULT_CALENDAR_VIEW_PREFS, type CalendarViewPrefs } from "@/components/calendar"


const KEY = "safora_calendar_view_prefs"

function sanitize(raw: unknown): CalendarViewPrefs {
  const d = DEFAULT_CALENDAR_VIEW_PREFS
  if (typeof raw !== "object" || raw === null) return d
  const r = raw as Record<string, unknown>
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback
  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback)
  return {
    barMoney: oneOf(r.barMoney, ["glyph", "total", "remaining", "hidden"], d.barMoney),
    density: oneOf(r.density, ["compact", "default", "roomy"], d.density),
    guestBadge: bool(r.guestBadge, d.guestBadge),
    cleaningBadge: bool(r.cleaningBadge, d.cleaningBadge),
    weekendTint: bool(r.weekendTint, d.weekendTint),
    animations: bool(r.animations, d.animations),
  }
}

function load(): CalendarViewPrefs {
  try {
    const s = localStorage.getItem(KEY)
    return s ? sanitize(JSON.parse(s)) : DEFAULT_CALENDAR_VIEW_PREFS
  } catch {
    return DEFAULT_CALENDAR_VIEW_PREFS
  }
}

function persist(prefs: CalendarViewPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
  }
}

export function useCalendarPrefs(): {
  prefs: CalendarViewPrefs
  update: (patch: Partial<CalendarViewPrefs>) => void
  reset: () => void
} {
  const [prefs, setPrefs] = useState<CalendarViewPrefs>(load)
  const update = useCallback((patch: Partial<CalendarViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])
  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY)
    } catch {
    }
    setPrefs(DEFAULT_CALENDAR_VIEW_PREFS)
  }, [])
  return { prefs, update, reset }
}
