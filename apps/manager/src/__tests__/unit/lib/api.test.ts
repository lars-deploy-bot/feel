import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError, api } from "@/lib/api"

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("ApiError", () => {
  it("stores status and code", () => {
    const err = new ApiError("bad", 403, "FORBIDDEN")
    expect(err.message).toBe("bad")
    expect(err.status).toBe(403)
    expect(err.code).toBe("FORBIDDEN")
    expect(err.name).toBe("ApiError")
  })

  it("code is undefined when omitted", () => {
    const err = new ApiError("fail", 500)
    expect(err.code).toBeUndefined()
  })
})

describe("api.get", () => {
  it("includes credentials in requests", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))

    await api.get("/test")

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    )
  })

  it("returns parsed JSON for successful requests", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [1, 2, 3] }))

    const result = await api.get<{ data: number[] }>("/items")

    expect(result).toEqual({ data: [1, 2, 3] })
  })

  it("throws ApiError with string error body on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404))

    try {
      await api.get("/missing")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      const err = e as InstanceType<typeof ApiError>
      expect(err.message).toBe("Not found")
      expect(err.status).toBe(404)
    }
  })

  it("throws ApiError with structured error body (code + message)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "ORG_LIMIT", message: "Too many orgs" } }, 422))

    try {
      await api.get("/orgs")
      expect.unreachable("should have thrown")
    } catch (e) {
      const err = e as InstanceType<typeof ApiError>
      expect(err.message).toBe("Too many orgs")
      expect(err.status).toBe(422)
      expect(err.code).toBe("ORG_LIMIT")
    }
  })

  it("falls back to status text when response body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("server error", { status: 500, statusText: "Internal Server Error" }))

    try {
      await api.get("/broken")
      expect.unreachable("should have thrown")
    } catch (e) {
      const err = e as InstanceType<typeof ApiError>
      expect(err.message).toBe("Internal Server Error")
      expect(err.status).toBe(500)
    }
  })
})

describe("api.post", () => {
  it("sends JSON body with POST method", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "abc" } }))

    await api.post("/orgs", { name: "Test Org" })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Test Org" }),
        credentials: "include",
      }),
    )
  })

  it("sends no body when body is omitted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await api.post("/logout")

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/logout",
      expect.objectContaining({
        method: "POST",
        body: undefined,
      }),
    )
  })

  it("returns parsed JSON response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "new-123" } }))

    const result = await api.post<{ data: { id: string } }>("/orgs", { name: "X" })

    expect(result).toEqual({ data: { id: "new-123" } })
  })
})

describe("api.patch", () => {
  it("sends PATCH with body and returns void", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const result = await api.patch("/orgs/123/credits", { credits: 500 })

    expect(result).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/123/credits",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ credits: 500 }),
      }),
    )
  })
})

describe("api.delete", () => {
  it("sends DELETE request and returns void", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const result = await api.delete("/orgs/123")

    expect(result).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/123",
      expect.objectContaining({
        method: "DELETE",
      }),
    )
  })

  it("sends DELETE with body when provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await api.delete("/orgs/123/members/456", { reason: "removed" })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/123/members/456",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ reason: "removed" }),
      }),
    )
  })
})
