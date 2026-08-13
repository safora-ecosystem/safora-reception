import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEFAULT_CALENDAR_VIEW_PREFS, type CalendarViewPrefs } from "@/components/calendar"
import { onSessionReset } from "./reset-bus"


type CalendarState = CalendarViewPrefs & {
  readOnly: boolean
  update: (patch: Partial<CalendarViewPrefs>) => void
  resetPrefs: () => void
  setReadOnly: (on: boolean) => void
}

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

function readLegacy(): CalendarViewPrefs & { readOnly: boolean } {
  let prefs = DEFAULT_CALENDAR_VIEW_PREFS
  try {
    const s = localStorage.getItem("safora_calendar_view_prefs")
    if (s) prefs = sanitize(JSON.parse(s))
  } catch {
  }
  return { ...prefs, readOnly: localStorage.getItem("safora_calendar_readonly") === "1" }
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      ...DEFAULT_CALENDAR_VIEW_PREFS,
      readOnly: false,
      update: (patch) => set(patch),
      resetPrefs: () => set({ ...DEFAULT_CALENDAR_VIEW_PREFS }),
      setReadOnly: (readOnly) => set({ readOnly }),
    }),
    {
      name: "safora_calendar",
      version: 1,
      partialize: (s) => ({ ...sanitize(s), readOnly: s.readOnly }),
      migrate: (persisted) => persisted as CalendarState,
      merge: (persisted, current) => ({
        ...current,
        ...(persisted
          ? { ...sanitize(persisted), readOnly: (persisted as { readOnly?: unknown }).readOnly === true }
          : readLegacy()),
      }),
    },
  ),
)

if (typeof window !== "undefined") {
  onSessionReset(() => useCalendarStore.setState({ readOnly: false }))
  window.addEventListener("storage", (e) => {
    if (e.key === "safora_calendar") void useCalendarStore.persist.rehydrate()
  })
}
