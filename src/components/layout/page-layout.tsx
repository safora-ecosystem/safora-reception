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
        fill ? "flex grow flex-col p-4" : "p-4 sm:p-5",
      )}
    >
      <div className={cn("mx-auto w-full max-w-[120rem]", fill && "flex grow flex-col")}>
        {children}
      </div>
    </div>
  )
}
