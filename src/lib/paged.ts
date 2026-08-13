import { useMemo } from "react"
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query"


export type Page<T> = { items: T[]; nextCursor: string | null }

function asPage<T>(raw: Page<T> | T[]): Page<T> {
  return Array.isArray(raw) ? { items: raw, nextCursor: null } : raw
}

export function usePagedList<T>(
  key: QueryKey,
  fetchPage: (cursor: string | null) => Promise<Page<T> | T[]>,
  opts?: { enabled?: boolean; staleTime?: number },
) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam }) => asPage(await fetchPage(pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    ...opts,
  })
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  return { ...query, items }
}
