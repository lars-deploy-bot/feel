import { useCallback, useSyncExternalStore } from "react"

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")

function getPage(): string {
  const path = window.location.pathname
  const relative = path.startsWith(BASE) ? path.slice(BASE.length) : path
  // "/users" → "users", "/" → "", "" → ""
  const segment = relative.replace(/^\//, "").split("/")[0]
  return segment || "organizations"
}

function subscribe(cb: () => void): () => void {
  window.addEventListener("popstate", cb)
  return () => window.removeEventListener("popstate", cb)
}

export function useRoute() {
  const page = useSyncExternalStore(subscribe, getPage)

  const navigate = useCallback((id: string, params?: Record<string, string>) => {
    const search = params ? `?${new URLSearchParams(params).toString()}` : ""
    const url = `${BASE}/${id}${search}`
    window.history.pushState(null, "", url)
    // Trigger re-render via popstate listeners
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, [])

  return { page, navigate }
}
