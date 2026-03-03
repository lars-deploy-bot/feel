import { describe, expect, it } from "vitest"
import { handleBody, handleParams, isHandleBodyError } from "../server"

describe("API server validation provenance", () => {
  it("marks params validation failures with details.input='params'", async () => {
    const result = await handleParams("automations/get-by-id", {
      params: { id: "" },
    })

    expect(isHandleBodyError(result)).toBe(true)
    if (!isHandleBodyError(result)) {
      throw new Error("Expected NextResponse for invalid params")
    }

    const data = await result.json()
    expect(result.status).toBe(400)
    expect(data.error).toBe("INVALID_REQUEST")
    expect(data.details.input).toBe("params")
  })

  it("marks body validation failures with details.input='body'", async () => {
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    })

    const result = await handleBody("login", req)

    expect(isHandleBodyError(result)).toBe(true)
    if (!isHandleBodyError(result)) {
      throw new Error("Expected NextResponse for invalid body")
    }

    const data = await result.json()
    expect(result.status).toBe(400)
    expect(data.error).toBe("INVALID_REQUEST")
    expect(data.details.input).toBe("body")
  })

  it("marks malformed JSON as body input failure", async () => {
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    })

    const result = await handleBody("login", req)

    expect(isHandleBodyError(result)).toBe(true)
    if (!isHandleBodyError(result)) {
      throw new Error("Expected NextResponse for malformed JSON")
    }

    const data = await result.json()
    expect(result.status).toBe(400)
    expect(data.error).toBe("INVALID_REQUEST")
    expect(data.details.input).toBe("body")
  })
})
