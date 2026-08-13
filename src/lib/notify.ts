import { useNotifyStore, type AlertToneId, type NotifyPrefs, type ToneId } from "@/stores/notify-store"
import type { TKey } from "./i18n"


export type { AlertToneId, NotifyPrefs, ToneId }

const DEFAULTS: NotifyPrefs = { sound: true, desktop: false, tone: "marimba", alertTone: "dingdong" }

export const TONES: Array<{ id: ToneId; labelKey: TKey; hintKey: TKey }> = [
  { id: "marimba", labelKey: "tones.marimba", hintKey: "tones.marimbaHint" },
  { id: "bell", labelKey: "tones.bell", hintKey: "tones.bellHint" },
  { id: "pop", labelKey: "tones.pop", hintKey: "tones.popHint" },
]

export const ALERT_TONES: Array<{ id: AlertToneId; labelKey: TKey; hintKey: TKey }> = [
  { id: "trill", labelKey: "alertTones.trill", hintKey: "alertTones.trillHint" },
  { id: "dingdong", labelKey: "alertTones.dingdong", hintKey: "alertTones.dingdongHint" },
  { id: "pulse", labelKey: "alertTones.pulse", hintKey: "alertTones.pulseHint" },
]

export function readNotifyPrefs(): NotifyPrefs {
  const { sound, desktop, tone, alertTone } = useNotifyStore.getState()
  return { sound, desktop, tone, alertTone }
}

export function useNotifyPrefs() {
  const sound = useNotifyStore((s) => s.sound)
  const desktop = useNotifyStore((s) => s.desktop)
  const tone = useNotifyStore((s) => s.tone)
  const alertTone = useNotifyStore((s) => s.alertTone)
  return {
    prefs: { sound, desktop, tone, alertTone },
    set: useNotifyStore.getState().set,
  }
}

let ctx: AudioContext | null = null

function ensureCtx(): AudioContext {
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error("WebAudio yo'q")
  ctx ??= new Ctor()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

if (typeof window !== "undefined") {
  const unlock = () => {
    try {
      ensureCtx()
    } catch {
    }
    window.removeEventListener("pointerdown", unlock)
    window.removeEventListener("keydown", unlock)
  }
  window.addEventListener("pointerdown", unlock)
  window.addEventListener("keydown", unlock)
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


function toneTrill(ac: AudioContext, out: AudioNode, t0: number): void {
  const notes = [440, 523.25, 659.25]
  notes.forEach((freq, i) => marimbaHit(ac, out, freq, t0 + i * 0.09, 0.34))
}

function bellHit(ac: AudioContext, out: AudioNode, freq: number, at: number, vol: number): void {
  const partials: Array<[number, number, number]> = [
    [1, vol, 0.9],
    [2, vol * 0.22, 0.45],
    [4, vol * 0.06, 0.2],
  ]
  for (const [mult, v, dur] of partials) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = "sine"
    osc.frequency.value = freq * mult
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(v, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(gain)
    gain.connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }
}

function toneDingdong(ac: AudioContext, out: AudioNode, t0: number): void {
  bellHit(ac, out, 587.33, t0, 0.34)
  bellHit(ac, out, 493.88, t0 + 0.28, 0.38)
}

function tonePulse(ac: AudioContext, out: AudioNode, t0: number): void {
  for (const at of [t0, t0 + 0.19]) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(185, at)
    osc.frequency.exponentialRampToValueAtTime(118, at + 0.1)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.6, at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17)
    osc.connect(gain)
    gain.connect(out)
    osc.start(at)
    osc.stop(at + 0.22)
  }
}

const PLAYERS: Record<ToneId | AlertToneId, (ac: AudioContext, out: AudioNode, t0: number) => void> = {
  marimba: toneMarimba,
  bell: toneBell,
  pop: tonePop,
  trill: toneTrill,
  dingdong: toneDingdong,
  pulse: tonePulse,
}

export function previewTone(tone: ToneId | AlertToneId): void {
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

export function playAlertChime(): void {
  const prefs = readNotifyPrefs()
  if (!prefs.sound) return
  previewTone(prefs.alertTone)
}

export function showDesktopNotification(title: string, body: string, tag = "safora-chat"): void {
  const { desktop } = readNotifyPrefs()
  if (!desktop || typeof Notification === "undefined") return
  if (Notification.permission !== "granted") return
  if (document.visibilityState === "visible") return
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag })
  } catch {
  }
}

export async function requestDesktopPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  return (await Notification.requestPermission()) === "granted"
}
