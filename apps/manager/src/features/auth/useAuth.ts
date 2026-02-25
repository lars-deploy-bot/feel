import { useCallback, useEffect, useState } from "react"
import { api, ApiError } from "@/lib/api"

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ authenticated: boolean }>("/auth/me")
      .then(() => setAuthenticated(true))
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) {
          setAuthenticated(false)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (passcode: string) => {
    await api.post("/auth/login", { passcode })
    setAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    await api.post("/auth/logout")
    setAuthenticated(false)
  }, [])

  return { authenticated, loading, login, logout }
}
