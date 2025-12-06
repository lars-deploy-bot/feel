import { useCallback, useEffect, useState } from "react"
import { useAuthStatus } from "@/lib/stores/authStore"

interface User {
  id: string
  email: string
  name: string | null
  /** Whether user can select any model without their own API key */
  canSelectAnyModel: boolean
  /** Whether user has admin privileges (can toggle feature flags, etc.) */
  isAdmin: boolean
}

/**
 * Check if user is authenticated
 * Returns user info if logged in, null otherwise
 *
 * This hook:
 * 1. Checks auth on mount
 * 2. Re-checks when authStore.status changes to "authenticated"
 *    (e.g., after login via AuthModal)
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen to authStore status changes
  const authStatus = useAuthStatus()

  const checkAuth = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/user")
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("[useAuth] Failed to check authentication:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Re-check when authStore status becomes "authenticated"
  // This handles the case where user logs in via AuthModal
  useEffect(() => {
    if (authStatus === "authenticated" && !user && !loading) {
      // Auth store says we're authenticated but we don't have user data
      // This means login just happened - re-fetch user
      checkAuth()
    }
  }, [authStatus, user, loading, checkAuth])

  return {
    user,
    loading,
    isAuthenticated: !!user,
    refetch: checkAuth,
  }
}
