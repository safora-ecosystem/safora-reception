import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-control border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-900 transition-colors outline-none",
        "placeholder:text-neutral-400/70",
        "hover:border-neutral-300",
        "focus-visible:border-neutral-400 focus-visible:ring-3 focus-visible:ring-neutral-400/20",
        "disabled:pointer-events-none disabled:bg-neutral-100 disabled:text-neutral-500",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
