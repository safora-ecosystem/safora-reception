import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const TRACK = {
  default: "h-6 w-11",
  sm: "h-5 w-9",
} as const

const THUMB = {
  default: "size-5 data-checked:translate-x-5",
  sm: "size-4 data-checked:translate-x-4",
} as const

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer relative inline-flex shrink-0 items-center rounded-full px-0.5 transition-colors outline-none after:absolute after:-inset-x-2 after:-inset-y-2.5 focus-visible:ring-3 focus-visible:ring-ring/40 data-checked:bg-primary data-unchecked:bg-neutral-300 data-disabled:pointer-events-none data-disabled:opacity-50",
        TRACK[size],
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-primary-foreground shadow-xs ring-0 transition-transform data-unchecked:translate-x-0",
          THUMB[size],
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
