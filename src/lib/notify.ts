import { useEffect, useState } from "react"

export type NotifyPrefs = { sound: boolean; desktop: boolean }

const KEY = "safora_notify"
const DEFAULTS: NotifyPrefs = { sound: true, desktop: false }

export function readNotifyPrefs(): NotifyPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotifyPrefs>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function writeNotifyPrefs(next: NotifyPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("safora:notify-prefs"))
}

export function useNotifyPrefs() {
  const [prefs, setPrefs] = useState<NotifyPrefs>(readNotifyPrefs)

  useEffect(() => {
    const sync = () => setPrefs(readNotifyPrefs())
    window.addEventListener("safora:notify-prefs", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("safora:notify-prefs", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return {
    prefs,
    set: (patch: Partial<NotifyPrefs>) => {
      const next = { ...readNotifyPrefs(), ...patch }
      writeNotifyPrefs(next)
      setPrefs(next)
    },
  }
}

let ctx: AudioContext | null = null

export function playMessageChime(): void {
  if (!readNotifyPrefs().sound) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === "suspended") void ctx.resume()

    const now = ctx.currentTime
    for (const [i, freq] of [659.25, 783.99].entries()) {
      const at = now + i * 0.09
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.42, at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.34)
    }
  } catch {
  }
}

export function showDesktopNotification(title: string, body: string): void {
  const { desktop } = readNotifyPrefs()
  if (!desktop || typeof Notification === "undefined") return
  if (Notification.permission !== "granted") return
  if (document.visibilityState === "visible") return
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "safora-chat" })
  } catch {
  }
}

export async function requestDesktopPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  return (await Notification.requestPermission()) === "granted"
}
