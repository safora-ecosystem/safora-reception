import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-brand-600 active:bg-brand-700",
        outline:
          "border-border bg-background hover:bg-neutral-50 active:bg-neutral-100 aria-expanded:bg-neutral-100",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-neutral-200 active:bg-neutral-300 aria-expanded:bg-neutral-200",
        ghost:
          "text-neutral-700 hover:bg-neutral-100 hover:text-foreground active:bg-neutral-200 aria-expanded:bg-neutral-100 aria-expanded:text-foreground",
        destructive:
          "bg-destructive-surface text-destructive-surface-foreground hover:bg-[color-mix(in_oklch,var(--destructive-surface),var(--destructive)_12%)] active:bg-[color-mix(in_oklch,var(--destructive-surface),var(--destructive)_20%)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        "destructive-solid":
          "bg-destructive text-on-fill hover:bg-[color-mix(in_oklch,var(--destructive),black_10%)] active:bg-[color-mix(in_oklch,var(--destructive),black_18%)] focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-[0.625rem] px-2.5 text-[0.8125rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 rounded-[0.875rem] px-4 text-[0.9375rem] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-11 gap-2 rounded-xl px-5 text-[0.9375rem] [&_svg:not([class*='size-'])]:size-[1.125rem]",
        icon: "size-8",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[0.625rem]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
