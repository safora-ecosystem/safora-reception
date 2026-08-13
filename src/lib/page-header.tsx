import type { ReactNode } from "react"
import {
  usePageHeaderActions,
  usePageHeaderTitle,
  useSetPageHeader as useSetShellPageHeader,
} from "@/stores/shell-store"


type PageHeader = { title: ReactNode; actions?: ReactNode }

export function usePageHeader(): PageHeader {
  const title = usePageHeaderTitle()
  const actions = usePageHeaderActions()
  return { title, actions }
}

export function useSetPageHeader(title: ReactNode, actions?: ReactNode): void {
  useSetShellPageHeader(title, actions)
}
