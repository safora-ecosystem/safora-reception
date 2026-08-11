import { useQuery } from "@tanstack/react-query"
import { getMyPermissions } from "@/lib/api"

const STALE_MS = 5 * 60_000

export function usePermissions() {
  const q = useQuery({
    queryKey: ["permissions", "me"],
    queryFn: getMyPermissions,
    staleTime: STALE_MS,
    retry: 1,
  })

  const granted = q.data?.granted

  return {
    loading: !q.isSuccess && !q.isError,
    role: q.data?.role,
    backdateDays: q.data?.backdateDays === undefined ? 0 : q.data.backdateDays,
    can: (key: string) => (granted ? granted.includes(key) : true),
  }
}
