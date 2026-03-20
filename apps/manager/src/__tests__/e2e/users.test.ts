import { expect, test } from "@playwright/test"

const PASSCODE = process.env.ALIVE_PASSCODE

test.describe("Users API", () => {
  test.skip(!PASSCODE, "ALIVE_PASSCODE env var required")

  let authCookie: string

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: { passcode: PASSCODE },
    })
    expect(loginRes.ok()).toBe(true)
    authCookie = loginRes.headers()["set-cookie"].split(";")[0]
  })

  test("GET /api/manager/users returns user list", async ({ request }) => {
    const res = await request.get("/api/manager/users", {
      headers: { cookie: authCookie },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBeGreaterThan(0)

    const user = body.data[0]
    expect(user).toHaveProperty("user_id")
    expect(user).toHaveProperty("email")
    expect(user).toHaveProperty("status")
    expect(user).toHaveProperty("created_at")
  })

  test("GET /api/manager/users rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/manager/users")
    expect(res.status()).toBe(401)
  })
})
