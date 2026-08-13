import { create } from "zustand"


export type RealtimeStatus = "connecting" | "connected" | "disconnected"

const GRACE_MS = 2500

type RealtimeState = {
  rawStatus: RealtimeStatus
  status: RealtimeStatus
  setRawStatus: (raw: RealtimeStatus) => void
}

let graceTimer: ReturnType<typeof setTimeout> | null = null
let leftAt: number | null = null

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  rawStatus: "connecting",
  status: "connected",
  setRawStatus: (raw) => {
    if (raw === "connected") {
      leftAt = null
      if (graceTimer !== null) {
        clearTimeout(graceTimer)
        graceTimer = null
      }
      set({ rawStatus: raw, status: "connected" })
      return
    }
    set({ rawStatus: raw })
    if (leftAt === null) leftAt = Date.now()
    if (graceTimer !== null) clearTimeout(graceTimer)
    const wait = Math.max(0, GRACE_MS - (Date.now() - leftAt))
    graceTimer = setTimeout(() => {
      graceTimer = null
      set({ status: get().rawStatus })
    }, wait)
  },
}))
