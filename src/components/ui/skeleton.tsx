import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("skeleton-shimmer rounded-lg bg-neutral-100", className)}
      {...props}
    />
  )
}
