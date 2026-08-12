import type { ComponentProps, ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { CheckIcon } from "lucide-react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

function firstLine(text: string): string {
  return text.split(/[\r\n]/, 1)[0]!.trim()
}

export function AuthField({
  label,
  trailing,
  className,
  onPaste,
  ...props
}: ComponentProps<"input"> & {
  label: string
  trailing?: ReactNode
}) {
  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    onPaste?.(event)
    if (event.defaultPrevented) return

    const pasted = event.clipboardData.getData("text")
    const clean = firstLine(pasted)
    if (clean === pasted) return

    event.preventDefault()
    const input = event.currentTarget
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const next = input.value.slice(0, start) + clean + input.value.slice(end)

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    setValue?.call(input, next)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    const caret = start + clean.length
    input.setSelectionRange(caret, caret)
  }

  return (
    <div className="auth-field relative">
      <label
        className={cn(
          "flex h-14 cursor-text flex-col justify-center rounded-xl border border-border bg-surface-field px-4",
          "transition-[border-color,box-shadow] focus-within:border-neutral-400",
          "focus-within:ring-3 focus-within:ring-neutral-400/20",
        )}
      >
        <span className="text-xs leading-4 font-medium text-muted-foreground">{label}</span>
        <input
          {...props}
          onPaste={handlePaste}
          className={cn(
            "mt-0.5 h-5 w-full min-w-0 bg-transparent text-[0.9375rem] leading-5 text-foreground outline-none",
            "placeholder:text-neutral-400/70",
            trailing && "pr-10",
            className,
          )}
        />
      </label>

      {}
      {trailing ? (
        <span className="absolute top-1/2 right-2.5 -translate-y-1/2">{trailing}</span>
      ) : null}
    </div>
  )
}

export function AuthFieldAction({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-neutral-400/30 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  )
}

export function AuthSubmit({
  loading,
  loadingLabel,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button> & {
  loading: boolean
  loadingLabel: string
}) {
  const still = useReducedMotion()
  const shift = still ? 0 : 4
  const transition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <Button
      type="submit"
      aria-busy={loading}
      disabled={disabled || loading}
      className={cn(
        "h-14 w-full rounded-xl text-base font-semibold disabled:opacity-100",
        loading ? "cursor-progress" : "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
        <motion.span
          aria-hidden={loading}
          initial={false}
          animate={{ opacity: loading ? 0 : 1, y: loading ? -shift : 0 }}
          transition={transition}
        >
          {children}
        </motion.span>
        <motion.span
          aria-hidden={!loading}
          className="flex items-center gap-2.5"
          initial={false}
          animate={{ opacity: loading ? 1 : 0, y: loading ? 0 : shift }}
          transition={transition}
        >
          <Icon icon={Loading03Icon} className="size-[1.125rem] animate-spin" strokeWidth={2.5} />
          {loadingLabel}
        </motion.span>
      </span>
    </Button>
  )
}

export function AuthCheckbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <span className="relative grid size-4 shrink-0 place-items-center">
      <input
        type="checkbox"
        className={cn(
          "peer size-4 appearance-none rounded-[0.3125rem] border border-neutral-300 bg-surface-field transition-colors outline-none",
          "hover:border-neutral-400 checked:border-primary checked:bg-primary",
          "focus-visible:ring-3 focus-visible:ring-neutral-400/30",
          className,
        )}
        {...props}
      />
      {}
      <CheckIcon
        strokeWidth={3.5}
        className="pointer-events-none absolute size-2.5 text-primary-foreground opacity-0 peer-checked:opacity-100"
      />
    </span>
  )
}
