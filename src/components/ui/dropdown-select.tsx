import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"


export interface DropdownOption<T extends string> {
  value: T
  label: string
}

interface DropdownSelectProps<T extends string> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  triggerClassName?: string
  "aria-label"?: string
}

export function DropdownSelect<T extends string>({
  value,
  options,
  onChange,
  triggerClassName,
  "aria-label": ariaLabel,
}: DropdownSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn("h-9 justify-between gap-2 font-normal", triggerClassName)}
        >
          <span className="truncate">{current?.label ?? ""}</span>
          <ChevronDown className="size-4 shrink-0 text-neutral-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-40 p-1" role="listbox">
        {options.map((o) => {
          const selected = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-sm transition-colors",
                selected
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-neutral-700 hover:bg-neutral-100",
              )}
            >
              <span className="truncate">{o.label}</span>
              {selected && <Check className="size-4 shrink-0 text-brand-600" />}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
