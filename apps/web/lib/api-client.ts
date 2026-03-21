/**
 * Server-to-server client for apps/api (Hono on localhost:5080).
 *
 * Used by apps/web server components and route handlers to call the API app.
 * No browser-facing surface — just typed fetch wrappers over localhost.
 */

const API_BASE = "http://localhost:5080/api"

function getPasscode(): string {
  const passcode = process.env.ALIVE_PASSCODE
  if (!passcode) throw new Error("ALIVE_PASSCODE is not set — cannot authenticate with API app")
  return passcode
}

export class ApiClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiClientError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getPasscode()}`,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const msg = typeof body.error === "string" ? body.error : (body.error?.message ?? `Request failed (${res.status})`)
    throw new ApiClientError(msg, res.status)
  }

  return res.json()
}

/**
 * Raw fetch to the API app — no Content-Type override.
 * Use for multipart/form-data or other non-JSON payloads.
 */
async function rawRequest<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getPasscode()}`,
      ...init.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const msg = typeof body.error === "string" ? body.error : (body.error?.message ?? `Request failed (${res.status})`)
    throw new ApiClientError(msg, res.status)
  }

  return res.json()
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Post raw body (e.g. FormData) without JSON Content-Type */
  postRaw: <T>(path: string, body: BodyInit) => rawRequest<T>(path, { method: "POST", body }),
}
