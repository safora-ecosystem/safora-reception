import { create } from "zustand"
import { persist } from "zustand/middleware"
import { onSessionReset } from "./reset-bus"


export type ToneId = "marimba" | "bell" | "pop"
export type AlertToneId = "trill" | "dingdong" | "pulse"

export type NotifyPrefs = { sound: boolean; desktop: boolean; tone: ToneId; alertTone: AlertToneId }

const DEFAULTS: NotifyPrefs = { sound: true, desktop: false, tone: "marimba", alertTone: "dingdong" }

const TONE_IDS: readonly string[] = ["marimba", "bell", "pop"]
const ALERT_IDS: readonly string[] = ["trill", "dingdong", "pulse"]

function sanitize(raw: unknown): NotifyPrefs {
  if (typeof raw !== "object" || raw === null) return DEFAULTS
  const r = raw as Record<string, unknown>
  return {
    sound: typeof r.sound === "boolean" ? r.sound : DEFAULTS.sound,
    desktop: typeof r.desktop === "boolean" ? r.desktop : DEFAULTS.desktop,
    tone: TONE_IDS.includes(r.tone as string) ? (r.tone as ToneId) : DEFAULTS.tone,
    alertTone: ALERT_IDS.includes(r.alertTone as string)
      ? (r.alertTone as AlertToneId)
      : DEFAULTS.alertTone,
  }
}

function readLegacy(): NotifyPrefs & { seenNotices: string[] } {
  let prefs = DEFAULTS
  let seen: string[] = []
  try {
    const raw = localStorage.getItem("safora_notify")
    if (raw) prefs = sanitize(JSON.parse(raw))
  } catch {
  }
  try {
    const rawSeen = JSON.parse(localStorage.getItem("safora_notices_seen") ?? "[]")
    if (Array.isArray(rawSeen)) seen = rawSeen.filter((k): k is string => typeof k === "string")
  } catch {
  }
  return { ...prefs, seenNotices: seen }
}

type NotifyState = NotifyPrefs & {
  seenNotices: string[]
  set: (patch: Partial<NotifyPrefs>) => void
  setSeenNotices: (keys: string[]) => void
}

export const useNotifyStore = create<NotifyState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      seenNotices: [],
      set: (patch) => set(patch),
      setSeenNotices: (seenNotices) => set({ seenNotices }),
    }),
    {
      name: "safora_notifications",
      version: 1,
      migrate: (persisted) => persisted as NotifyState,
      partialize: (s) => ({
        sound: s.sound,
        desktop: s.desktop,
        tone: s.tone,
        alertTone: s.alertTone,
        seenNotices: s.seenNotices,
      }),
      merge: (persisted, current) => {
        if (!persisted) return { ...current, ...readLegacy() }
        const p = persisted as Partial<NotifyState>
        return {
          ...current,
          ...sanitize(p),
          seenNotices: Array.isArray(p.seenNotices)
            ? p.seenNotices.filter((k): k is string => typeof k === "string")
            : [],
        }
      },
    },
  ),
)

if (typeof window !== "undefined") {
  onSessionReset(() => useNotifyStore.setState({ seenNotices: [] }))
}
