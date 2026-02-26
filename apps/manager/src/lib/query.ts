import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — data is fresh for half a minute
      gcTime: 5 * 60_000, // 5min — keep unused data in cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
