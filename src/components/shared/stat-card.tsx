import { ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"
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
          <span className="text-[2.5rem] leading-none font-semibold tracking-tight tabular-nums">
            {value}
          </span>
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

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}
