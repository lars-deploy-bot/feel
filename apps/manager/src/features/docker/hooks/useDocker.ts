import { useQuery } from "@tanstack/react-query"
import { dockerApi } from "../docker.api"

const DOCKER_KEY: readonly ["docker"] = ["docker"]

export function useDocker() {
  const {
    data: containers = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: DOCKER_KEY,
    queryFn: dockerApi.list,
    staleTime: 10_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch containers") : null

  return { containers, loading, error, refresh: () => refetch() }
}
