import { useEffect, useState } from "react"
import { Spinner } from "@/components/shared/error-state"

export function OfflineBanner() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2.5 rounded-panel bg-neutral-100 px-5 py-2.5 text-sm text-neutral-600"
    >
      <Spinner className="text-neutral-400" />
      Aloqa yo'q — ulanish tiklanishi kutilmoqda
    </div>
  )
}
