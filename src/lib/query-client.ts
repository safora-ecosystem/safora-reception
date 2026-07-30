import { QueryClient } from "@tanstack/react-query"
import { isRateLimitError, isRetryableApiError } from "./api-error"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => isRetryableApiError(error) && failureCount < 2,
      retryDelay: (attempt, error) => {
        const base = isRateLimitError(error) ? 4000 : 1000
        return Math.min(base * 2 ** attempt, 15_000) + Math.random() * 500
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
})
