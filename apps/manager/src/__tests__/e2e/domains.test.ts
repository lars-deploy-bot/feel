import { expect, test } from "@playwright/test"

const PASSCODE = process.env.ALIVE_PASSCODE

test.describe("Domains API", () => {
  test.skip(!PASSCODE, "ALIVE_PASSCODE env var required")

  let authCookie: string

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: { passcode: PASSCODE },
    })
    expect(loginRes.ok()).toBe(true)
    const setCookie = loginRes.headers()["set-cookie"]
    expect(setCookie).toBeTruthy()
    authCookie = setCookie.split(";")[0]
  })

  test("GET /api/manager/domains returns domain list", async ({ request }) => {
    const res = await request.get("/api/manager/domains", {
      headers: { cookie: authCookie },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
  })

  test("GET /api/manager/domains rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/manager/domains")
    expect(res.status()).toBe(401)
  })
})
