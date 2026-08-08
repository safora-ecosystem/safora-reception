import { useLayoutEffect, useRef } from "react"
import { getLocale, numberNames } from "@/lib/i18n"
import { cn } from "@/lib/utils"


const MAX_DIGITS = 12

function groupDigits(digits: string): string {
  const trimmed = digits.replace(/^0+(?=\d)/, "")
  if (trimmed === "") return ""
  return new Intl.NumberFormat(numberNames(getLocale()).numberLocale).format(Number(trimmed))
}

const SIZES = {
  md: {
    box: "h-11 px-11 text-base",
    unit: "right-3 text-xs",
  },
  lg: {
    box: "h-14 px-16 text-2xl",
    unit: "right-5 text-sm",
  },
} as const

export function MoneyInput({
  value,
  onChange,
  ariaLabel,
  placeholder = "0",
  size = "md",
  invalid = false,
  disabled = false,
  autoFocus = false,
  className,
}: {
  value: string
  onChange: (rawDigits: string) => void
  ariaLabel: string
  placeholder?: string
  size?: keyof typeof SIZES
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const s = SIZES[size]

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current == null) return
    el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const digitsBeforeCaret = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, "").length
    const digits = el.value.replace(/\D/g, "").slice(0, MAX_DIGITS)
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
    <div className={cn("relative", className)}>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        value={value === "" ? "" : groupDigits(value)}
        onChange={handleChange}
        className={cn(
          "w-full rounded-control border bg-white text-center font-semibold text-neutral-900 tabular-nums transition-colors outline-none",
          "placeholder:font-medium placeholder:text-neutral-300",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
          s.box,
          invalid
            ? "border-destructive focus-visible:ring-3 focus-visible:ring-destructive/15"
            : "border-neutral-200 hover:border-neutral-300 focus-visible:border-neutral-400 focus-visible:ring-3 focus-visible:ring-neutral-400/20",
        )}
      />
      {}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 font-medium text-neutral-400 select-none",
          s.unit,
        )}
      >
        {numberNames(getLocale()).currency}
      </span>
    </div>
  )
}
