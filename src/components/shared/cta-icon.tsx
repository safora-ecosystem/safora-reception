import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function CtaIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full bg-primary-foreground text-primary",
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={3} />
    </span>
  )
}
