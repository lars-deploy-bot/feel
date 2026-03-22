import { useQuery } from "@tanstack/react-query"
import { servicesApi } from "../services.api"

const SERVICES_KEY: readonly ["services"] = ["services"]

export function useServices() {
  const {
    data: services = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: SERVICES_KEY,
    queryFn: servicesApi.list,
    staleTime: 10_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch services") : null

  return { services, loading, error, refresh: () => refetch() }
}
