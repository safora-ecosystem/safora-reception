import { useState, type ReactNode } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useT } from "@/lib/i18n"
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
  const t = useT()
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
            <span className="text-[0.625rem] font-normal text-neutral-400">
              {t("charts.plannedNote")}
            </span>
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


export function ChartEmpty({ label, className }: { label?: string; className?: string }) {
  const t = useT()
  return (
    <div
      className={cn(
        "flex min-h-32 flex-1 items-center justify-center rounded-control border border-dashed border-border text-sm text-neutral-400",
        className,
      )}
    >
      {label ?? t("charts.noData")}
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
  ariaLabel,
}: {
  options: RangeOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  const t = useT()
  return (
    <Tabs
      value={String(value)}
      onValueChange={(next) => {
        const picked = options.find((option) => String(option.value) === next)
        if (picked) onChange(picked.value)
      }}
      className="shrink-0"
    >
      <TabsList aria-label={ariaLabel ?? t("charts.timeWindow")} className="h-9">
        {options.map((option) => (
          <TabsTrigger
            key={String(option.value)}
            value={String(option.value)}
            className="px-3 tabular-nums"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}


export function ChartTableToggle({ children }: { children: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-800 hover:underline"
      >
        {}
        {open ? t("charts.hideNumbers") : t("charts.numbers")}
      </button>
      {open && <div className="app-scroll mt-2 max-h-56 overflow-auto">{children}</div>}
    </div>
  )
}

