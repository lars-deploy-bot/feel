import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useAuthStatus } from "@/lib/stores/authStore"
import { queryKeys } from "@/lib/tanstack/queryKeys"

export interface User {
  id: string
  email: string
  name: string | null
  /** Whether user can select any model without their own API key */
  canSelectAnyModel: boolean
  /** Whether user has admin privileges (can toggle feature flags, etc.) */
  isAdmin: boolean
}

interface ApiUserResponse {
  ok: boolean
  user?: User | null
  error?: string
}

/**
 * Fetch current user from /api/user
 * Uses TanStack Query for automatic caching and deduplication
 *
 * Cache Strategy:
 * - Fresh for 5 minutes (no refetch during this window)
 * - Kept in memory for 30 minutes
 * - After 5 min: Shows cached data while refetching in background
 * - After 30 min: Garbage collected if unused
 *
 * Benefits:
 * - Settings opened 10x = 1 request (automatic deduplication)
 * - Repeated settings opens are instant (from cache)
 * - Login triggers immediate refetch (authStore integration)
 * - 401 errors handled gracefully (return null)
 */
function useUserQuery() {
  return useQuery<User | null, Error, User | null>({
    queryKey: queryKeys.user.detail(),
    queryFn: async () => {
      const response = await fetch("/api/user", { credentials: "include" })

      // Handle 401 specially - not an error, just unauthenticated
      if (response.status === 401) {
        return null
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch user`)
      }

      const data: ApiUserResponse = await response.json()
      if (!data.ok) {
        throw new Error(data.error || "Invalid response")
      }

      return data.user || null
    },
    // User data doesn't change often - keep fresh for 5 min
    staleTime: 5 * 60 * 1000,
    // Keep in memory for 30 min in case user opens settings repeatedly
    gcTime: 30 * 60 * 1000,
    // Don't refetch on window focus (annoying for users)
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to check if user is authenticated
 * Returns user info if logged in, null otherwise
 *
 * Re-fetches when:
 * - Component mounts for the first time
 * - User logs in via AuthModal (detected via authStore)
 * - Query becomes stale (after 5 minutes)
 * - Network reconnects and data is stale
 *
 * Usage:
 * ```tsx
 * const { user, loading, isAuthenticated, refetch, error } = useAuth()
 *
 * if (loading) return <Skeleton />
 * if (error) return <Error />
 * if (!isAuthenticated) return <LoginPrompt />
 * return <Dashboard user={user} />
 * ```
 */
export function useAuth() {
  const queryClient = useQueryClient()
  const authStatus = useAuthStatus()
  const { data: user = null, isLoading: loading, refetch, error } = useUserQuery()

  // When user logs in via AuthModal, invalidate cache to get fresh user data
  useEffect(() => {
    if (authStatus === "authenticated" && !user) {
      // Login just happened - invalidate cache and refetch
      // This triggers a new /api/user request
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all })
    }
  }, [authStatus, user, queryClient])

  return {
    user,
    loading,
    isAuthenticated: !!user,
    refetch,
    error,
  }
}
