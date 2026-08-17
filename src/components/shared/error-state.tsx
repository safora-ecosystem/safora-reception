import { useCallback, useEffect, useRef, useState } from "react"
import { redirectIfSessionDead } from "@/lib/api"
import { classifyApiError, describeApiError, isConnectionError } from "@/lib/api-error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"


const AUTO_DELAYS = [5, 10, 20] as const
const MAX_AUTO_CYCLES = 3

function ConnectionPending({
  variant,
  className,
}: {
  variant: "page" | "section" | "inline"
  className?: string
}) {
  if (variant === "inline") {
    return (
      <div aria-busy="true" className={cn("flex items-center py-1.5", className)}>
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
    )
  }
  return (
    <div
      aria-busy="true"
      className={cn(
        "flex w-full flex-col justify-center gap-2.5",
        variant === "page" ? "min-h-64 flex-1 p-8" : "px-6 py-8",
        className,
      )}
    >
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current/25 border-t-current",
        className,
      )}
    />
  )
}

type ErrorStateProps = {
  error: unknown
  onRetry?: () => unknown | Promise<unknown>
  variant?: "page" | "section" | "inline"
  className?: string
}

export function ErrorState({ error, onRetry, variant = "section", className }: ErrorStateProps) {
  const t = useT()
  const info = classifyApiError(error)
  const text = describeApiError(info, t)
  const outage = isConnectionError(error)
  const [retrying, setRetrying] = useState(false)
  const [autoCycle, setAutoCycle] = useState(0)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const runRetry = useCallback(async () => {
    if (!onRetry) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      if (mountedRef.current) setRetrying(false)
    }
  }, [onRetry])
  const runRetryRef = useRef(runRetry)
  runRetryRef.current = runRetry

  const [sessionAlive, setSessionAlive] = useState(false)
  const authRetriedRef = useRef(false)
  useEffect(() => {
    if (info.kind !== "auth") return
    let cancelled = false
    void redirectIfSessionDead().then((redirecting) => {
      if (cancelled || redirecting) return
      setSessionAlive(true)
      if (!authRetriedRef.current) {
        authRetriedRef.current = true
        void runRetryRef.current()
      }
    })
    return () => {
      cancelled = true
    }
  }, [info.kind])

  const redirectingAuth = info.kind === "auth" && !sessionAlive

  const autoArmed =
    onRetry != null &&
    info.retryable &&
    !outage &&
    !retrying &&
    autoCycle < MAX_AUTO_CYCLES

  useEffect(() => {
    if (!autoArmed) return
    let remaining = AUTO_DELAYS[Math.min(autoCycle, AUTO_DELAYS.length - 1)]
    const id = window.setInterval(() => {
      if (document.hidden) return
      remaining -= 1
      if (remaining > 0) return
      window.clearInterval(id)
      setAutoCycle((c) => c + 1)
      void runRetryRef.current()
    }, 1000)
    return () => window.clearInterval(id)
  }, [autoArmed, autoCycle])


  const connecting = retrying || autoArmed

  const retryButton = onRetry != null && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void runRetry()}
      disabled={retrying}
      className="gap-2 font-normal"
    >
      {connecting && <Spinner />}
      {connecting ? t("common.retrying") : t("common.retry")}
    </Button>
  )

  if (outage) return <ConnectionPending variant={variant} className={className} />

  if (variant === "inline") {
    return (
      <div role="alert" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5", className)}>
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-600">
          {redirectingAuth ? t("errors.sessionExpired.redirecting") : text.title}
        </span>
        {redirectingAuth ? <Spinner className="text-neutral-400" /> : retryButton}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" ? "h-full min-h-64 flex-1 p-8" : "px-6 py-12",
        className,
      )}
    >
      <p
        className={cn(
          "font-medium text-neutral-900",
          variant === "page" ? "text-base" : "text-sm",
        )}
      >
        {text.title}
      </p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-neutral-500">
        {redirectingAuth ? t("errors.sessionExpired.redirecting") : text.description}
      </p>
      {redirectingAuth ? (
        <Spinner className="mt-4 text-neutral-400" />
      ) : (
        retryButton && <div className="mt-4">{retryButton}</div>
      )}
    </div>
  )
}
