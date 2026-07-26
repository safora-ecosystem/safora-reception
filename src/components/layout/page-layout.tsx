import { type ReactNode } from "react"
import { useSetPageHeader } from "@/lib/page-header"
import { cn } from "@/lib/utils"

type PageLayoutProps = {
  title: string
  actions?: ReactNode
  fill?: boolean
  children: ReactNode
}

export function PageLayout({ title, actions, fill = false, children }: PageLayoutProps) {
  useSetPageHeader(title, actions)

  return (
    <div
      className={cn(
        fill ? "flex grow flex-col p-4" : "px-6 py-6 sm:px-8 sm:py-7",
      )}
    >
      <div className={cn("mx-auto w-full max-w-[1760px]", fill && "flex min-h-0 grow flex-col")}>
        {children}
      </div>
    </div>
  )
}
