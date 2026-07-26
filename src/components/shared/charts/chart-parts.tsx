import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { LegendItem, RangeOption, TooltipRow } from "./chart-hooks"




export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span
            aria-hidden
            className={cn("size-2.5 shrink-0 rounded-full", item.hatch && "bar-hatch border border-border")}
            style={item.hatch ? undefined : { backgroundColor: item.color }}
          />
          {item.label}
          {item.value && <span className="font-medium tabular-nums text-neutral-800">{item.value}</span>}
        </span>
      ))}
    </div>
  )
}


export function ChartTooltip({
  title,
  rows,
  align = "center",
  placement = "above",
}: {
  title: string
  rows: TooltipRow[]
  align?: "start" | "center" | "end"
  placement?: "above" | "below"
}) {
  const box = cn(
    "pointer-events-none absolute z-20 min-w-max rounded-lg border border-border bg-popover px-2.5 py-2 shadow-md",
    placement === "above" ? "bottom-full mb-2" : "top-0",
    align === "center" && "left-1/2 -translate-x-1/2",
    align === "start" && "left-0",
    align === "end" && "right-0",
  )

  if (rows.length === 1) {
    const row = rows[0]
    return (
      <div role="tooltip" className={box}>
        <p className="text-[0.6875rem] font-medium text-neutral-500">{title}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5 text-sm leading-tight font-semibold text-neutral-900 tabular-nums">
          {row.value}
          {row.hatch && (
            <span className="text-[0.625rem] font-normal text-neutral-400">rejada</span>
          )}
        </p>
      </div>
    )
  }

  return (
    <div role="tooltip" className={box}>
      <p className="text-[0.6875rem] font-medium text-neutral-500">{title}</p>
      <div className="mt-1 flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", row.hatch && "bar-hatch")}
              style={row.hatch ? undefined : { backgroundColor: row.color }}
            />
            <span className="text-neutral-600">{row.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-neutral-900">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


export function ChartEmpty({ label = "Ma'lumot yo'q", className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-1 items-center justify-center rounded-control border border-dashed border-border text-sm text-neutral-400",
        className,
      )}
    >
      {label}
    </div>
  )
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <div className={cn("min-h-32 flex-1 animate-pulse rounded-control bg-neutral-100", className)} />
}


export function RangeToggle<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel = "Vaqt oynasi",
}: {
  options: RangeOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex shrink-0 gap-0.5 rounded-control border border-border bg-white p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[0.5rem] px-2.5 py-1 text-[0.8125rem] font-medium whitespace-nowrap tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              selected
                ? "bg-accent text-accent-foreground"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}


export function ChartTableToggle({ children, label = "Raqamlar" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-800 hover:underline"
      >
        {open ? `${label}ni yashirish` : label}
      </button>
      {open && <div className="app-scroll mt-2 max-h-56 overflow-auto">{children}</div>}
    </div>
  )
}

