import { cn } from "@/lib/utils"

export function VersionTag({ className }: { className?: string }) {
  return (
    <span className={cn("text-[11px] leading-none tabular-nums text-neutral-400", className)}>
      v{__APP_VERSION__}
    </span>
  )
}
