import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { clockOf, dayLabel } from "@/lib/format"
import { useT, type TKey } from "@/lib/i18n"
import { VersionTag } from "./version-tag"

function shiftKey(now: Date): TKey {
  const hour = now.getHours()
  if (hour >= 6 && hour < 14) return "shift.morning"
  if (hour >= 14 && hour < 22) return "shift.day"
  return "shift.night"
}

function RollingTime({ time, className }: { time: string; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn("flex tabular-nums", className)} aria-label={time}>
      {time.split("").map((ch, i) =>
        ch === ":" ? (
          <span key="colon" className="px-[0.05em] opacity-80" aria-hidden>
            :
          </span>
        ) : (
          <span
            key={i}
            aria-hidden
            className="relative inline-flex justify-center overflow-hidden"
            style={{ width: "0.6em", height: "1em" }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={ch}
                initial={reduce ? false : { y: "120%", opacity: 0, filter: "blur(5px)" }}
                animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { y: "-120%", opacity: 0, filter: "blur(5px)" }}
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : { type: "spring", stiffness: 300, damping: 26, mass: 0.8 }
                }
                className="absolute inset-0 flex items-center justify-center leading-none"
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        ),
      )}
    </div>
  )
}

export function ShiftCard() {
  const t = useT()
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
    ? { dot: "bg-success", label: t("shift.online") }
    : isError
      ? { dot: "bg-destructive", label: t("shift.offline") }
      : { dot: "bg-neutral-400", label: t("shift.checking") }

  return (
    <div className="surface-dark relative overflow-hidden rounded-[15px] px-4 py-3.5 text-on-fill">
      <span
        className={cn("absolute top-3 right-3 size-2 rounded-full ring-2 ring-white/15", conn.dot)}
        title={conn.label}
        aria-label={conn.label}
      />
      <RollingTime
        time={clockOf(now)}
        className="text-2xl leading-none font-semibold tracking-tight"
      />
      <p className="mt-1.5 text-xs text-on-fill-55">{dayLabel(now)}</p>
      {}
      <p className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-on-fill-55">
        <span>{t(shiftKey(now))}</span>
        <VersionTag className="shrink-0 text-on-fill-40" />
      </p>
    </div>
  )
}
