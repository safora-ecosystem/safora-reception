import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

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
      className="flex shrink-0 items-center gap-2.5 rounded-panel bg-destructive-surface px-5 py-2.5 text-sm font-medium text-destructive-surface-foreground"
    >
      <WifiOff className="size-4 shrink-0" strokeWidth={2} />
      Internet aloqasi yo'q — qayta ulanilmoqda…
    </div>
  )
}
