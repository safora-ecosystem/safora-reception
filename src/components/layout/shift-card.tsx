import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { uzDate, uzTime } from "@/lib/datetime"

export function ShiftCard() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { isSuccess, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<unknown>("/health"),
  })
  const conn = isSuccess
    ? { dot: "bg-success", label: "Backend ulangan" }
    : isError
      ? { dot: "bg-destructive", label: "Backend ulanmadi" }
      : { dot: "bg-neutral-400", label: "Tekshirilmoqda" }

  return (
    <div className="surface-dark relative overflow-hidden rounded-card px-4 py-3.5 text-white">
      <span
        className={cn("absolute top-3 right-3 size-2 rounded-full ring-2 ring-white/15", conn.dot)}
        title={conn.label}
        aria-label={conn.label}
      />
      <p className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{uzTime(now)}</p>
      <p className="mt-1.5 text-xs text-white/55">{uzDate(now)}</p>
      {}
      <p className="mt-1.5 text-xs text-white/55">Tonggi smena</p>
    </div>
  )
}
