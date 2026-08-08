import { Icon, type IconData } from "@/components/ui/icon"
import { cn } from "@/lib/utils"


export type SegmentedTabItem<T extends string> = {
  value: T
  label: string
  icon?: IconData
  count?: number
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
  ariaLabel,
  className,
}: {
  value: T
  onChange: (value: T) => void
  items: ReadonlyArray<SegmentedTabItem<T>>
  ariaLabel?: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex gap-0.5 rounded-full bg-neutral-100 p-1", className)}
    >
      {items.map((item) => {
        const active = item.value === value
        const count = item.count ?? 0
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {count > 0 ? (
              <span
                className="inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] leading-none font-semibold tabular-nums text-primary-foreground"
              >
                {count > 99 ? "99+" : count}
              </span>
            ) : (
              item.icon && <Icon icon={item.icon} className="size-4 shrink-0" />
            )}
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
