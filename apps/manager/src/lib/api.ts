// In dev with Vite proxy, BASE_URL is "/manager-2/" so API calls go to "/manager-2/api/..."
// In production (standalone), BASE_URL is "/" so API calls go to "/api/..."
const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/")

class ApiError extends Error {
  status: number
  code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    // API returns { error: { code, message } } or { error: "string" }
    const err = body.error
    const message = typeof err === "string" ? err : (err?.message ?? `Request failed: ${res.status}`)
    const code = typeof err === "string" ? body.code : err?.code
    throw new ApiError(message, res.status, code)
  }

  return res
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init)
  return res.json()
}

async function send(path: string, init?: RequestInit): Promise<void> {
  await request(path, init)
}

export const api = {
  get: <T>(path: string) => json<T>(path),
  post: <T>(path: string, body?: unknown) =>
    json<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    send(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string, body?: unknown) =>
    send(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
}

export { ApiError }
