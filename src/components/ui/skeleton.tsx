import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-lg bg-neutral-100", className)}
      {...props}
    />
  )
}
