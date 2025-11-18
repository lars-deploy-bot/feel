import { useEffect, useState } from "react"

interface User {
  id: string
  email: string
  name: string | null
}

/**
 * Check if user is authenticated
 * Returns user info if logged in, null otherwise
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/user")
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error("[useAuth] Failed to check authentication:", error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  return { user, loading, isAuthenticated: !!user }
}
