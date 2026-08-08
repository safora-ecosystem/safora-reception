import type { ComponentType, ReactNode } from "react"
import { InboxIcon } from "@hugeicons/core-free-icons"
import { Icon, type IconData } from "@/components/ui/icon"
import { cn } from "@/lib/utils"


type GlyphProp = IconData | ComponentType<{ className?: string; strokeWidth?: number | string }>

type EmptyStateProps = {
  icon?: GlyphProp
  title: string
  hint?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon = InboxIcon,
  title,
  hint,
  description,
  action,
  className,
}: EmptyStateProps) {
  const text = hint ?? description
  const Local = typeof icon === "function" ? icon : null
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        {Local ? (
          <Local className="size-5" strokeWidth={1.75} />
        ) : (
          <Icon icon={icon as IconData} className="size-5" />
        )}
      </span>
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {text && <p className="max-w-xs text-xs text-neutral-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
