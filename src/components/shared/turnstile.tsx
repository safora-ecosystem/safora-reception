import { useEffect, useRef } from "react"

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      appearance?: "always" | "execute" | "interaction-only"
      callback: (token: string) => void
      "expired-callback"?: () => void
      "error-callback"?: () => void
    },
  ) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loader: Promise<void> | null = null
function loadScript(): Promise<void> {
  loader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Turnstile skripti yuklanmadi"))
    document.head.appendChild(script)
  })
  return loader
}

export function Turnstile({
  onToken,
  resetSignal,
}: {
  onToken: (token: string | null) => void
  resetSignal: number
}) {
  const holder = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!SITEKEY || !holder.current) return
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: SITEKEY,
          appearance: "interaction-only",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        })
      })
      .catch(() => onTokenRef.current(null))

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [])

  useEffect(() => {
    if (resetSignal === 0) return
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current)
      onTokenRef.current(null)
    }
  }, [resetSignal])

  if (!SITEKEY) return null
  return <div ref={holder} className="flex justify-center" />
}

export const turnstileEnabled = Boolean(SITEKEY)
