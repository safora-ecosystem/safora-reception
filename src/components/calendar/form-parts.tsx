import { memo, useId } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { DropdownSelect } from "@/components/ui/dropdown-select"
import { cn } from "@/lib/utils"
import type { CalendarLabels } from "./types"


export const DOC_TYPES = ["passport", "id_card", "birth_certificate", "driver_license", "other"] as const

interface SegmentedOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export const Segmented = memo(SegmentedImpl, (prev, next) => {
  return (
    prev.value === next.value &&
    prev.tone === next.tone &&
    prev.size === next.size &&
    prev.className === next.className &&
    prev.options.length === next.options.length &&
    prev.options.every((o, i) => o.value === next.options[i].value && o.label === next.options[i].label)
  )
})

function SegmentedImpl({
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
  const reduce = useReducedMotion()
  const thumbId = useId()

  return (
    <div
      className={cn(
        "flex shrink-0 rounded-full bg-neutral-100 p-[3px]",
        size === "sm" ? "h-9" : "h-10",
        className,
      )}
      role="group"
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "relative inline-flex flex-1 items-center justify-center rounded-full font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              size === "sm" ? "px-2.5 text-[0.8125rem]" : "px-3.5 text-sm",
              active
                ? tone === "slate"
                  ? "text-cal-block-foreground"
                  : "text-neutral-900"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {active && (
              <motion.span
                layoutId={thumbId}
                transition={
                  reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                }
                className="absolute inset-0 rounded-full bg-white shadow-xs ring-1 ring-neutral-200/70"
              />
            )}
            {}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function DocSelect({
  labels,
  value,
  onChange,
  className,
}: {
  labels: CalendarLabels
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <DropdownSelect
      value={value}
      onChange={onChange}
      placeholder={labels.document}
      aria-label={labels.document}
      triggerClassName={cn("w-full", className)}
      options={[
        { value: "", label: labels.docTypeNone },
        ...DOC_TYPES.map((t) => ({ value: t as string, label: labels.docTypeText[t] })),
      ]}
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
      <DocSelect
        labels={labels}
        value={docType}
        onChange={(v) => {
          onDocType(v)
          if (!v) onDocNumber("")
        }}
      />
      <Input
        value={docNumber}
        onChange={(e) => onDocNumber(e.target.value)}
        placeholder={labels.docNumber}
        aria-label={labels.docNumber}
        disabled={!docType}
      />
    </div>
  )
}
