import { useQuery } from "@tanstack/react-query"
import { diskApi } from "../disk.api"

const DISK_KEY: readonly ["disk"] = ["disk"]

export function useDisk() {
  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: DISK_KEY,
    queryFn: diskApi.get,
    staleTime: 30_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch disk data") : null

  return {
    overview: data?.overview ?? [],
    sites: data?.sites ?? [],
    loading,
    error,
    refresh: () => refetch(),
  }
}
