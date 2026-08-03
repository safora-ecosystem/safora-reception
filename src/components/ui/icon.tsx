import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"

export type IconData = ComponentProps<typeof HugeiconsIcon>["icon"]

export function Icon({ strokeWidth = 1.75, ...props }: ComponentProps<typeof HugeiconsIcon>) {
  return <HugeiconsIcon strokeWidth={strokeWidth} {...props} />
}
