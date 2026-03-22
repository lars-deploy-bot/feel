import { useQuery } from "@tanstack/react-query"
import { processesApi } from "../processes.api"

const PROCESSES_KEY: readonly ["processes"] = ["processes"]

export function useProcesses() {
  const {
    data: processes = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: PROCESSES_KEY,
    queryFn: processesApi.list,
    staleTime: 5_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch processes") : null

  return { processes, loading, error, refresh: () => refetch() }
}
