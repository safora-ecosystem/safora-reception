import { memo, useId, useLayoutEffect, useRef } from "react"
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
        "flex shrink-0 rounded-control bg-neutral-100 p-[3px]",
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
              "relative inline-flex flex-1 items-center justify-center rounded-[calc(var(--radius-control)-3px)] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              size === "sm" ? "px-2.5 text-[0.8125rem]" : "px-3.5 text-sm",
              active
                ? tone === "slate"
                  ? "text-cal-block-foreground"
                  : "text-brand-700"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {active && (
              <motion.span
                layoutId={thumbId}
                transition={
                  reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                }
                className="absolute inset-0 rounded-[calc(var(--radius-control)-3px)] bg-white shadow-xs ring-1 ring-neutral-200/70"
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

function groupDigits(digits: string): string {
  const trimmed = digits.replace(/^0+(?=\d)/, "")
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

export function MoneyInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current == null) return
    el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const digitsBeforeCaret = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, "").length
    const digits = el.value.replace(/\D/g, "")
    const formatted = groupDigits(digits)

    let seen = 0
    let position = 0
    if (digitsBeforeCaret > 0) {
      position = formatted.length
      for (let i = 0; i < formatted.length; i++) {
        if (formatted.charCodeAt(i) >= 48 && formatted.charCodeAt(i) <= 57) {
          seen++
          if (seen === digitsBeforeCaret) {
            position = i + 1
            break
          }
        }
      }
    }
    caret.current = position
    onChange(digits.replace(/^0+(?=\d)/, ""))
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value === "" ? "" : groupDigits(value)}
      onChange={handleChange}
      className={cn(
        "h-9 rounded-control border border-neutral-200 bg-white px-2.5 text-right text-sm font-medium text-neutral-900 tabular-nums transition-colors outline-none placeholder:font-normal placeholder:text-neutral-400/70 hover:border-neutral-300 focus-visible:border-brand-400 focus-visible:ring-3 focus-visible:ring-ring/15",
        className,
      )}
    />
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
