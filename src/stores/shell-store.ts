import { useLayoutEffect, useRef, type ReactNode } from "react"
import { create } from "zustand"
import { onSessionReset } from "./reset-bus"


type ShellState = {
  headerTitle: ReactNode
  headerActions: ReactNode | undefined
  topbarSearch: string
}

export const useShellStore = create<ShellState>()(() => ({
  headerTitle: "",
  headerActions: undefined,
  topbarSearch: "",
}))

if (typeof window !== "undefined") {
  onSessionReset(() =>
    useShellStore.setState({ headerTitle: "", headerActions: undefined, topbarSearch: "" }),
  )
}

export function usePageHeaderTitle(): ReactNode {
  return useShellStore((s) => s.headerTitle)
}
export function usePageHeaderActions(): ReactNode | undefined {
  return useShellStore((s) => s.headerActions)
}

export function useSetPageHeader(title: ReactNode, actions?: ReactNode): void {
  const published = useRef<{ title: ReactNode; actions: ReactNode | undefined }>(undefined)

  useLayoutEffect(() => {
    useShellStore.setState({ headerTitle: title, headerActions: actions })
    published.current = { title, actions }
    if (typeof title === "string" && title) document.title = `${title} · Safora`
  }, [title, actions])

  // Unmount'da tozalash — keyingi sahifa e'lon qilmagunicha eski amal navbarda osilib
  // qolmasin. Identity tekshiruvi bilan: unmount kechiksa (masalan, chiqish animatsiyasi)
  // va YANGI sahifa allaqachon e'lon qilgan bo'lsa — uning yozuvi o'chirilmaydi.
  useLayoutEffect(
    () => () => {
      const s = useShellStore.getState()
      if (
        s.headerTitle === published.current?.title &&
        s.headerActions === published.current?.actions
      ) {
        useShellStore.setState({ headerTitle: "", headerActions: undefined })
      }
    },
    [],
  )
}

// ── Navbar qidiruvi ───────────────────────────────────────────────────────────

/** Modul funksiyasi — identity barqaror, iste'molchining unmount-tozalash effekti buzilmaydi. */
export function setTopbarSearch(query: string): void {
  useShellStore.setState({ topbarSearch: query })
}

export function useTopbarSearchValue(): string {
  return useShellStore((s) => s.topbarSearch)
}
