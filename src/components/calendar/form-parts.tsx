import { useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { groupThousands } from "./labels"
import type { CalendarLabels } from "./types"


export const DOC_TYPES = ["passport", "id_card", "birth_certificate", "driver_license", "other"] as const

interface SegmentedOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export function Segmented({
  value,
  onChange,
  options,
  tone = "brand",
  size = "md",
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: SegmentedOption[]
  tone?: "brand" | "slate"
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div className={cn("flex rounded-control bg-neutral-200/60 p-0.5", className)}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-0.125rem)] font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "px-2 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
              active
                ? tone === "slate"
                  ? "bg-white text-cal-block-foreground shadow-xs"
                  : "bg-white text-brand-700 shadow-xs"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function MoneyInput({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={focused || value === "" ? value : groupThousands(Number(value))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className={cn(
        "h-8 rounded-lg bg-neutral-100 px-2 text-right text-sm font-medium text-neutral-900 tabular-nums outline-none ring-1 ring-transparent transition-colors focus:bg-white focus:ring-brand-400",
        className,
      )}
    />
  )
}

export function DocFields({
  labels,
  docType,
  docNumber,
  onDocType,
  onDocNumber,
  compact = false,
}: {
  labels: CalendarLabels
  docType: string
  docNumber: string
  onDocType: (v: string) => void
  onDocNumber: (v: string) => void
  compact?: boolean
}) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-[9rem_1fr]" : "sm:grid-cols-[11rem_1fr]")}>
      <select
        aria-label={labels.document}
        value={docType}
        onChange={(e) => onDocType(e.target.value)}
        className="h-9 rounded-control bg-neutral-100 px-2.5 text-sm text-neutral-900 outline-none ring-1 ring-transparent transition-colors focus:bg-white focus:ring-brand-400"
      >
        <option value="">{labels.document}</option>
        {DOC_TYPES.map((t) => (
          <option key={t} value={t}>
            {labels.docTypeText[t]}
          </option>
        ))}
      </select>
      <Input
        value={docNumber}
        onChange={(e) => onDocNumber(e.target.value)}
        placeholder={labels.docNumber}
        aria-label={labels.docNumber}
      />
    </div>
  )
}
