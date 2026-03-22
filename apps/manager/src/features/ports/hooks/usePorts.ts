import { useQuery } from "@tanstack/react-query"
import { portsApi } from "../ports.api"

const PORTS_KEY: readonly ["ports"] = ["ports"]

export function usePorts() {
  const {
    data: ports = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: PORTS_KEY,
    queryFn: portsApi.list,
    staleTime: 10_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch ports") : null

  return {
    ports,
    loading,
    error,
    refresh: () => refetch(),
  }
}
