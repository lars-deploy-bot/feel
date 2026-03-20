import { expect, test } from "@playwright/test"

const PASSCODE = process.env.ALIVE_PASSCODE

test.describe("Organizations API", () => {
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

  test("GET /api/manager/orgs returns organization list", async ({ request }) => {
    const res = await request.get("/api/manager/orgs", {
      headers: { cookie: authCookie },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBeGreaterThan(0)

    const org = body.data[0]
    expect(org).toHaveProperty("org_id")
    expect(org).toHaveProperty("name")
    expect(org).toHaveProperty("credits")
    expect(org).toHaveProperty("member_count")
    expect(org).toHaveProperty("domain_count")
  })

  test("GET /api/manager/orgs rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/manager/orgs")
    expect(res.status()).toBe(401)
  })
})
