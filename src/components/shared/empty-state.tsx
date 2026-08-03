import type { ComponentType, ReactNode } from "react"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"


type EmptyStateProps = {
  icon?: ComponentType<{ className?: string; strokeWidth?: number | string }>
  title: string
  hint?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Glyph = Inbox,
  title,
  hint,
  description,
  action,
  className,
}: EmptyStateProps) {
  const text = hint ?? description
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <Glyph className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {text && <p className="max-w-xs text-xs text-neutral-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
