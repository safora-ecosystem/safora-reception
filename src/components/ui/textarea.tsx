import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-control border border-neutral-200 bg-white px-3 py-2 text-base transition-colors outline-none placeholder:text-neutral-400/70 hover:border-neutral-300 focus-visible:border-neutral-400 focus-visible:ring-3 focus-visible:ring-neutral-400/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
