import type { ReactNode } from "react"
import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"


export function ServiceColumn({
  id,
  title,
  count,
  children,
}: {
  id: string
  title: string
  count: number
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        "flex min-h-0 flex-col rounded-panel bg-neutral-50 transition-colors",
        isOver && "bg-accent/40 ring-2 ring-ring/50",
      )}
    >
      {}
      <header className="px-4 pt-4 pb-3">
        <h2 className="text-[0.9375rem] font-medium text-neutral-900">
          {title} <span className="text-neutral-400 tabular-nums">{count}</span>
        </h2>
      </header>

      {}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
        {children}
      </div>
    </section>
  )
}
