import { Inbox, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-16 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {hint && <p className="max-w-xs text-xs text-neutral-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
