import { Icon, type IconData } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

export function CtaIcon({ icon, className }: { icon: IconData; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full bg-primary-foreground text-primary",
        className,
      )}
    >
      <Icon icon={icon} className="size-3.5" strokeWidth={3} />
    </span>
  )
}
