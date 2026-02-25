import { useQuery } from "@tanstack/react-query"
import { usersApi } from "../users.api"

const USERS_KEY = ["users"] as const

export function useUsers() {
  const {
    data: users = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: USERS_KEY,
    queryFn: usersApi.list,
    staleTime: 30_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch users") : null

  return {
    users,
    loading,
    error,
    refresh: () => refetch(),
  }
}
