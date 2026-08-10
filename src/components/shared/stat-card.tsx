import { ArrowUpRight01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Children, type ReactNode, useId } from "react"
import { Link } from "@tanstack/react-router"
import { motion, useReducedMotion } from "framer-motion"
import { RollingNumber } from "@/components/shared/rolling-number"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { fadeInUp, staggerContainer } from "@/lib/motion-presets"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string
  unit?: string
  hint?: string
  info?: string
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
  info,
}: StatCardProps) {
  const infoId = useId()
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 font-medium",
            compact ? "text-sm" : "text-[0.9375rem]",
            hero ? "text-hero-foreground/85" : "text-neutral-500"
          )}
        >
          {info && <MetricInfo text={info} hero={hero} compact={compact} />}
          {label}
        </span>
        {}
        {to && (
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
        )}
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

      {}
      {info && (
        <span id={infoId} aria-hidden className="sr-only">
          {info}
        </span>
      )}
    </>
  )

  const shell = cn(
    "relative flex flex-col overflow-hidden rounded-card",
    compact ? "gap-1 px-4 py-3" : "gap-1.5 px-5 py-3.5",
    hero
      ? "surface-dark border border-transparent text-on-fill"
      : "border border-border bg-card text-neutral-900"
  )

  const describedBy = info ? infoId : undefined

  if (!to)
    return (
      <div className={shell} aria-describedby={describedBy}>
        {body}
      </div>
    )

  return (
    <Link
      to={to}
      title={linkTitle}
      aria-describedby={describedBy}
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

function MetricInfo({ text, hero, compact }: { text: string; hero: boolean; compact: boolean }) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            title=""
            className={cn(
              "flex shrink-0 cursor-help items-center transition-colors",
              hero
                ? "text-hero-foreground/55 hover:text-hero-foreground"
                : "text-neutral-300 hover:text-neutral-500"
            )}
          >
            <Icon icon={InformationCircleIcon} className={compact ? "size-3.5" : "size-4"} />
          </span>
        </TooltipTrigger>
        {}
        <TooltipContent
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="max-w-[17.5rem] text-left leading-relaxed"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const span = Math.min(cols, Math.max(items.length, 1))
  const gridClass = cn(
    "grid grid-cols-1 gap-4",
    items.length > 1 && "@2xl:grid-cols-2",
    span >= 5
      ? "@6xl:grid-cols-5"
      : span === 4
        ? "@5xl:grid-cols-4"
        : span === 3
          ? "@4xl:grid-cols-3"
          : ""
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

export function StatBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("flex-col gap-0 p-0 @2xl:flex-row @2xl:items-stretch", className)}>
      {children}
    </Card>
  )
}

type StatBarItemProps = {
  label: string
  value: string
  unit?: string
  hint?: string
  info?: string
  to?: string
  linkTitle?: string
}

export function StatBarItem({ label, value, unit, hint, info, to, linkTitle }: StatBarItemProps) {
  const infoId = useId()
  const cell = cn(
    "flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-5 py-3",
    "border-t border-border first:border-t-0 @2xl:border-t-0 @2xl:border-l @2xl:first:border-l-0"
  )
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-500">
        {info && <MetricInfo text={info} hero={false} compact />}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <RollingNumber value={value} className="text-[1.375rem] font-semibold tracking-tight text-neutral-900" />
        {unit && <span className="text-sm font-medium text-neutral-400 tabular-nums">{unit}</span>}
      </span>
      {hint && <span className="truncate text-[0.6875rem] text-neutral-500">{hint}</span>}
      {info && (
        <span id={infoId} aria-hidden className="sr-only">
          {info}
        </span>
      )}
    </>
  )

  if (!to)
    return (
      <div className={cell} aria-describedby={info ? infoId : undefined}>
        {body}
      </div>
    )

  return (
    <Link
      to={to}
      title={linkTitle}
      aria-describedby={info ? infoId : undefined}
      className={cn(
        cell,
        "transition-colors outline-none hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/40"
      )}
    >
      {body}
    </Link>
  )
}
