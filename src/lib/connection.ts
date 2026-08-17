import { toast } from "sonner"
import { pingApi } from "./api"
import { isConnectionError } from "./api-error"
import { t } from "./i18n"
import { queryClient } from "./query-client"


const TOAST_ID = "connection"

const PROBE_DELAYS = [3_000, 6_000, 12_000, 20_000, 30_000] as const

type Mode = "offline" | "unreachable"

let armed = false
let down = false
let mode: Mode | null = null
let attempt = 0
let timer: ReturnType<typeof setTimeout> | undefined
let probing = false

const isOffline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false
const isHidden = (): boolean => typeof document !== "undefined" && document.hidden

function clearTimer(): void {
  if (timer === undefined) return
  clearTimeout(timer)
  timer = undefined
}

function announce(next: Mode): void {
  if (next === mode) return
  mode = next
  toast.loading(next === "offline" ? t("connection.offline") : t("connection.lost"), {
    id: TOAST_ID,
    description: next === "offline" ? t("connection.offlineHint") : t("connection.lostHint"),
    duration: Infinity,
    dismissible: false,
  })
}

function reportOutage(): void {
  const first = !down
  down = true
  if (first) attempt = 0
  announce(isOffline() ? "offline" : "unreachable")
  scheduleProbe()
}

function reportOnline(): void {
  if (!down) return
  down = false
  mode = null
  attempt = 0
  clearTimer()
  toast.success(t("connection.restored"), {
    id: TOAST_ID,
    description: undefined,
    duration: 3_000,
    dismissible: true,
  })
  void queryClient.refetchQueries({ type: "active" })
}

function scheduleProbe(): void {
  if (!down || probing || timer !== undefined) return
  timer = setTimeout(() => {
    timer = undefined
    void runProbe()
  }, PROBE_DELAYS[Math.min(attempt, PROBE_DELAYS.length - 1)])
}

async function runProbe(): Promise<void> {
  if (!down || probing) return
  if (isHidden() || isOffline()) {
    scheduleProbe()
    return
  }
  probing = true
  attempt += 1
  let alive = false
  try {
    await pingApi()
    alive = true
  } catch {
  }
  probing = false
  if (alive) reportOnline()
  else scheduleProbe()
}

export function initConnectionWatch(): void {
  if (armed) return
  armed = true

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return
    const { action } = event
    if (action.type === "error") {
      if (isConnectionError(action.error)) reportOutage()
      return
    }
    if (action.type === "success" && !action.manual) reportOnline()
  })

  queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated") return
    const { action } = event
    if (action.type === "error") {
      if (isConnectionError(action.error)) reportOutage()
      return
    }
    if (action.type === "success") reportOnline()
  })

  window.addEventListener("offline", () => reportOutage())
  window.addEventListener("online", () => {
    if (!down) return
    announce("unreachable")
    attempt = 0
    clearTimer()
    void runProbe()
  })
  document.addEventListener("visibilitychange", () => {
    if (!down || isHidden()) return
    clearTimer()
    void runProbe()
  })

  if (isOffline()) reportOutage()
}
