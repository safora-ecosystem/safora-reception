import { useCallback, useEffect, useRef, useState } from "react"
import {
  Ban,
  Clock,
  Hourglass,
  Loader2,
  RefreshCw,
  SearchX,
  ServerCrash,
  TriangleAlert,
  WifiOff,
} from "lucide-react"
import { classifyApiError, type ApiErrorKind } from "@/lib/api-error"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"


const AUTO_DELAYS = [5, 10, 20] as const
const MAX_AUTO_CYCLES = 3
const CALM_HINT_AFTER = 3

const KIND_ICON: Record<ApiErrorKind, typeof WifiOff> = {
  offline: WifiOff,
  network: WifiOff,
  timeout: Hourglass,
  server: ServerCrash,
  ratelimit: Clock,
  auth: Ban,
  forbidden: Ban,
  notfound: SearchX,
  client: TriangleAlert,
  unknown: TriangleAlert,
}

function chipClass(kind: ApiErrorKind): string {
  switch (kind) {
    case "offline":
    case "network":
    case "timeout":
    case "ratelimit":
      return "bg-warning-surface text-warning-surface-foreground"
    case "forbidden":
    case "notfound":
    case "auth":
      return "bg-neutral-100 text-neutral-400"
    default:
      return "bg-destructive-surface text-destructive-surface-foreground"
  }
}

type ErrorStateProps = {
  error: unknown
  onRetry?: () => void | Promise<unknown>
  variant?: "page" | "section" | "inline"
  className?: string
}

export function ErrorState({ error, onRetry, variant = "section", className }: ErrorStateProps) {
  const info = classifyApiError(error)
  const [attempts, setAttempts] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [autoCycle, setAutoCycle] = useState(0)
  const [autoCancelled, setAutoCancelled] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const runRetry = useCallback(
    async (manual: boolean) => {
      if (!onRetry) return
      if (manual) setAttempts((n) => n + 1)
      setRetrying(true)
      try {
        await onRetry()
      } finally {
        if (mountedRef.current) setRetrying(false)
      }
    },
    [onRetry],
  )
  const runRetryRef = useRef(runRetry)
  runRetryRef.current = runRetry

  const autoArmed =
    onRetry != null &&
    info.retryable &&
    info.kind !== "offline" &&
    !autoCancelled &&
    !retrying &&
    autoCycle < MAX_AUTO_CYCLES

  useEffect(() => {
    if (!autoArmed) {
      setCountdown(null)
      return
    }
    let remaining = AUTO_DELAYS[Math.min(autoCycle, AUTO_DELAYS.length - 1)]
    setCountdown(remaining)
    const id = window.setInterval(() => {
      if (document.hidden) return
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
        return
      }
      window.clearInterval(id)
      setCountdown(null)
      setAutoCycle((c) => c + 1)
      void runRetryRef.current(false)
    }, 1000)
    return () => window.clearInterval(id)
  }, [autoArmed, autoCycle])

  useEffect(() => {
    if (info.kind !== "offline" || onRetry == null) return
    const onOnline = () => void runRetryRef.current(false)
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [info.kind, onRetry])

  const Icon = KIND_ICON[info.kind]

  const retryButton = onRetry != null && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void runRetry(true)}
      disabled={retrying}
      className="rounded-lg"
    >
      {retrying ? (
        <Loader2 className="animate-spin" strokeWidth={1.75} />
      ) : (
        <RefreshCw strokeWidth={1.75} />
      )}
      {retrying ? "Urinilmoqda…" : attempts > 0 ? `Qayta urinish (${attempts + 1})` : "Qayta urinish"}
    </Button>
  )

  const countdownRow = countdown != null && !retrying && (
    <p className="flex items-center gap-2 text-xs text-neutral-400 tabular-nums">
      {countdown} soniyadan so'ng qayta uriniladi…
      <button
        type="button"
        onClick={() => setAutoCancelled(true)}
        className="font-medium text-neutral-500 underline-offset-2 hover:underline"
      >
        Bekor qilish
      </button>
    </p>
  )

  const calmHint = attempts >= CALM_HINT_AFTER && (
    <p className="text-xs text-neutral-400">Muammo davom etsa, birozdan so'ng qayta kiring.</p>
  )

  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center gap-2.5 rounded-control bg-neutral-50 px-3 py-2",
          className,
        )}
      >
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", chipClass(info.kind))}>
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{info.title}</span>
        {retryButton}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        variant === "page" ? "h-full min-h-64 flex-1 p-8" : "px-6 py-12",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full",
          variant === "page" ? "size-12" : "size-11",
          chipClass(info.kind),
        )}
      >
        <Icon className={variant === "page" ? "size-6" : "size-5"} strokeWidth={1.75} />
      </span>
      <p
        className={cn(
          "mt-1 font-medium text-neutral-900",
          variant === "page" ? "text-[0.9375rem]" : "text-sm",
        )}
      >
        {info.title}
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-neutral-500">{info.description}</p>
      {(retryButton || countdownRow || calmHint) && (
        <div className="mt-2 flex flex-col items-center gap-2">
          {retryButton}
          {countdownRow}
          {calmHint}
        </div>
      )}
    </div>
  )
}
