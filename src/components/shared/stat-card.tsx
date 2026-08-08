import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Children, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { motion, useReducedMotion } from "framer-motion"
import { RollingNumber } from "@/components/shared/rolling-number"
import { fadeInUp, staggerContainer } from "@/lib/motion-presets"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string
  unit?: string
  hint?: string
  hero?: boolean
  to?: string
  linkTitle?: string
  compact?: boolean
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  hero = false,
  compact = false,
  to,
  linkTitle,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "font-medium",
            compact ? "text-sm" : "text-[0.9375rem]",
            hero ? "text-hero-foreground/85" : "text-neutral-500"
          )}
        >
          {label}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border",
            compact ? "size-6" : "size-7",
            hero ? "border-white/25 text-hero-foreground" : "border-border text-neutral-400"
          )}
        >
          <Icon icon={ArrowUpRight01Icon} className={compact ? "size-3" : "size-3.5"} strokeWidth={2} />
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          {}
          <RollingNumber
            value={value}
            className={cn(
              "font-semibold tracking-tight",
              compact ? "text-[1.875rem]" : "text-[2.25rem]"
            )}
          />
          {unit && (
            <span
              className={cn(
                "font-medium tabular-nums",
                compact ? "text-base" : "text-lg",
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
              compact ? "text-xs" : "text-[0.8125rem]",
              hero ? "text-hero-foreground/80" : "text-neutral-500"
            )}
          >
            {hint}
          </span>
        )}
      </div>
    </>
  )

  const shell = cn(
    "relative flex flex-col overflow-hidden rounded-card",
    compact ? "gap-1 px-4 py-3" : "gap-1.5 px-5 py-3.5",
    hero
      ? "surface-dark border border-transparent text-on-fill"
      : "border border-border bg-card text-neutral-900"
  )

  if (!to) return <div className={shell}>{body}</div>

  return (
    <Link
      to={to}
      title={linkTitle}
      className={cn(
        shell,
        "transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        hero ? "hover:brightness-110" : "hover:bg-accent/40"
      )}
    >
      {body}
    </Link>
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
