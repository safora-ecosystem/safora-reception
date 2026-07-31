import { Children } from "react"
import { ArrowUpRight } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"
import { fadeInUp, staggerContainer } from "@/lib/motion-presets"
import { RollingNumber } from "@/components/shared/rolling-number"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string
  unit?: string
  hint?: string
  hero?: boolean
}

export function StatCard({ label, value, unit, hint, hero = false }: StatCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-card px-5 py-4",
        hero
          ? "sheen-brand border border-transparent bg-hero text-hero-foreground"
          : "border border-border bg-card text-neutral-900"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-[0.9375rem] font-medium",
            hero ? "text-hero-foreground/85" : "text-neutral-500"
          )}
        >
          {label}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border",
            hero ? "border-white/25 text-hero-foreground" : "border-border text-neutral-400"
          )}
        >
          <ArrowUpRight className="size-4" strokeWidth={2} />
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          {}
          <RollingNumber
            value={value}
            className="text-[2.5rem] font-semibold tracking-tight"
          />
          {unit && (
            <span
              className={cn(
                "text-lg font-medium tabular-nums",
                hero ? "text-hero-foreground/70" : "text-neutral-400"
              )}
            >
              {unit}
            </span>
          )}
        </div>
        {hint && (
          <span
            className={cn(
              "text-[0.8125rem]",
              hero ? "text-hero-foreground/80" : "text-neutral-500"
            )}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  )
}

export function StatGrid({
  children,
  cols = 4,
  animate = true,
}: {
  children: ReactNode
  cols?: 3 | 4 | 5
  animate?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const items = Children.toArray(children)
  const gridClass = cn(
    "grid grid-cols-1 gap-4 sm:grid-cols-2",
    cols === 5 ? "lg:grid-cols-5" : cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
  )

  if (!animate || reduceMotion) return <div className={gridClass}>{children}</div>

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className={gridClass}>
      {items.map((child, i) => (
        <motion.div key={i} variants={fadeInUp} className="min-w-0 [&>*]:h-full">
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
