import { createContext, useContext, useMemo, useState, type ReactNode } from "react"


interface TopbarSearchValue {
  query: string
  setQuery: (q: string) => void
}

const TopbarSearchContext = createContext<TopbarSearchValue | null>(null)

export function TopbarSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")
  const value = useMemo(() => ({ query, setQuery }), [query])
  return <TopbarSearchContext.Provider value={value}>{children}</TopbarSearchContext.Provider>
}

export function useTopbarSearch(): TopbarSearchValue {
  const ctx = useContext(TopbarSearchContext)
  if (!ctx) throw new Error("useTopbarSearch TopbarSearchProvider ichida ishlatilishi kerak")
  return ctx
}
