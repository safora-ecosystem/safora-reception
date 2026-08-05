import { Slot } from "radix-ui"
import type { ComponentProps, ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"


type ListCardProps = {
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  children: ReactNode
  scroll?: boolean
  className?: string
  bodyClassName?: string
}

export function ListCard({
  title,
  meta,
  action,
  children,
  scroll = true,
  className,
  bodyClassName,
}: ListCardProps) {
  return (
    <Card className={cn("gap-0 p-0", className)}>
      <header className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.9375rem] leading-tight font-semibold tracking-tight text-neutral-900">
            {title}
          </h3>
          {meta && <p className="mt-0.5 truncate text-xs text-neutral-500">{meta}</p>}
        </div>
        {action && <div className="-my-1 shrink-0">{action}</div>}
      </header>

      {}
      <div className="hairline-t shrink-0" />

      <div
        className={cn(
          "min-h-0 flex-1 px-3 py-2",
          scroll && "app-scroll overflow-y-auto",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </Card>
  )
}

export function ListRows({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("flex flex-col", className)} {...props} />
}

type ListRowProps = ComponentProps<"div"> & {
  asChild?: boolean
  interactive?: boolean
}

export function ListRow({ asChild, interactive, className, ...props }: ListRowProps) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      className={cn(
        "group/row flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
        interactive && [
          "cursor-pointer transition-colors outline-none",
          "hover:bg-neutral-100/70 focus-visible:bg-neutral-100/70",
          "focus-visible:ring-[3px] focus-visible:ring-ring/35",
          "hover:[&_[data-row-title]]:underline focus-visible:[&_[data-row-title]]:underline",
          "[&_[data-row-title]]:underline-offset-2",
        ],
        className,
      )}
      {...props}
    />
  )
}

export function RowText({
  title,
  caption,
  className,
}: {
  title: ReactNode
  caption?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <p data-row-title className="truncate text-sm font-medium text-neutral-900">
        {title}
      </p>
      {caption && <p className="truncate text-xs text-neutral-500">{caption}</p>}
    </div>
  )
}

export function RowIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 [&>svg]:size-[1.125rem]",
        className,
      )}
    >
      {children}
    </span>
  )
}
