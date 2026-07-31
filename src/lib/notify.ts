import { useEffect, useState } from "react"
import type { TKey } from "./i18n"

export type ToneId = "marimba" | "bell" | "pop"

export type NotifyPrefs = { sound: boolean; desktop: boolean; tone: ToneId }

const KEY = "safora_notify"
const DEFAULTS: NotifyPrefs = { sound: true, desktop: false, tone: "marimba" }

export const TONES: Array<{ id: ToneId; labelKey: TKey; hintKey: TKey }> = [
  { id: "marimba", labelKey: "tones.marimba", hintKey: "tones.marimbaHint" },
  { id: "bell", labelKey: "tones.bell", hintKey: "tones.bellHint" },
  { id: "pop", labelKey: "tones.pop", hintKey: "tones.popHint" },
]

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

function ensureCtx(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

function marimbaHit(ac: AudioContext, out: AudioNode, freq: number, at: number, vol: number): void {
  const layers: Array<[number, number, number]> = [
    [1, vol, 0.55],
    [4, vol * 0.14, 0.1],
  ]
  for (const [mult, v, dur] of layers) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = "sine"
    osc.frequency.value = freq * mult
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(v, at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(gain)
    gain.connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }
}

function toneMarimba(ac: AudioContext, out: AudioNode, t0: number): void {
  marimbaHit(ac, out, 440, t0, 0.5)
  marimbaHit(ac, out, 329.63, t0 + 0.16, 0.45)
}

function toneBell(ac: AudioContext, out: AudioNode, t0: number): void {
  const partials: Array<[number, number, number]> = [
    [493.88, 0.45, 1.0],
    [987.77, 0.12, 0.5],
    [1975.5, 0.04, 0.25],
  ]
  for (const [freq, vol, dur] of partials) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(out)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }
}

function tonePop(ac: AudioContext, out: AudioNode, t0: number): void {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = "sine"
  osc.frequency.setValueAtTime(700, t0)
  osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.08)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.007)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25)
  osc.connect(gain)
  gain.connect(out)
  osc.start(t0)
  osc.stop(t0 + 0.3)
}

const PLAYERS: Record<ToneId, (ac: AudioContext, out: AudioNode, t0: number) => void> = {
  marimba: toneMarimba,
  bell: toneBell,
  pop: tonePop,
}

export function previewTone(tone: ToneId): void {
  try {
    const ac = ensureCtx()
    const lp = ac.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 1600
    lp.Q.value = 0.5
    lp.connect(ac.destination)
    const player = PLAYERS[tone] ?? PLAYERS[DEFAULTS.tone]
    player(ac, lp, ac.currentTime)
  } catch {
  }
}

export function playMessageChime(): void {
  const prefs = readNotifyPrefs()
  if (!prefs.sound) return
  previewTone(prefs.tone)
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
