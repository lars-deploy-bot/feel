import { useQuery } from "@tanstack/react-query"
import { automationsApi } from "../automations.api"

const AUTOMATIONS_KEY: readonly ["automations"] = ["automations"]

export function useAutomations() {
  const {
    data: orgSummaries = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: AUTOMATIONS_KEY,
    queryFn: automationsApi.list,
    staleTime: 30_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch automations") : null

  return {
    orgSummaries,
    loading,
    error,
    refresh: () => refetch(),
  }
}
