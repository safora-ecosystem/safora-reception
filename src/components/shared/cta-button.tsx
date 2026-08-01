import type { ComponentProps } from "react"
import { PlusIcon, type LucideIcon } from "lucide-react"
import { CtaIcon } from "@/components/shared/cta-icon"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CtaButton({
  icon = PlusIcon,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { icon?: LucideIcon }) {
  return (
    <Button
      className={cn("h-auto gap-2.5 rounded-full py-2.5 pr-5 pl-3 text-[0.9375rem] font-semibold", className)}
      {...props}
    >
      <CtaIcon icon={icon} />
      {children}
    </Button>
  )
}
