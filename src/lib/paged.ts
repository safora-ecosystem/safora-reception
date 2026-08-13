import { useMemo } from "react"
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query"


export type Page<T> = { items: T[]; nextCursor: string | null }

export function usePagedList<T>(
  key: QueryKey,
  fetchPage: (cursor: string | null) => Promise<Page<T>>,
  opts?: { enabled?: boolean; staleTime?: number },
) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    ...opts,
  })
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  return { ...query, items }
}
