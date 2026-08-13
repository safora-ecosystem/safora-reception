import { setTopbarSearch, useTopbarSearchValue } from "@/stores/shell-store"

interface TopbarSearchValue {
  query: string
  setQuery: (q: string) => void
}

export function useTopbarSearch(): TopbarSearchValue {
  const query = useTopbarSearchValue()
  return { query, setQuery: setTopbarSearch }
}
