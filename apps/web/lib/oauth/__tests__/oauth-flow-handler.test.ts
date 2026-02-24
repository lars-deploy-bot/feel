import { OAUTH_MCP_PROVIDERS } from "@webalive/shared"
import { afterEach, describe, expect, it } from "vitest"
import { getOAuthConfig } from "../oauth-flow-handler"

const baseUrl = "https://example.com"
const envKeys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_SCOPES", "GOOGLE_CALENDAR_SCOPES"] as const

function setGoogleCredentials() {
  process.env.GOOGLE_CLIENT_ID = "google-client-id"
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret"
}

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key]
  }
})

describe("getOAuthConfig scope isolation", () => {
  it("google_calendar does not inherit GOOGLE_SCOPES", () => {
    setGoogleCredentials()
    process.env.GOOGLE_SCOPES = "https://www.googleapis.com/auth/gmail.modify"

    const config = getOAuthConfig("google_calendar", baseUrl)

    expect(config).not.toBeNull()
    expect(config?.scopes).toBe(OAUTH_MCP_PROVIDERS.google_calendar.defaultScopes)
  })

  it("google_calendar uses GOOGLE_CALENDAR_SCOPES when provided", () => {
    setGoogleCredentials()
    process.env.GOOGLE_CALENDAR_SCOPES = "scope.one scope.two"

    const config = getOAuthConfig("google_calendar", baseUrl)

    expect(config).not.toBeNull()
    expect(config?.scopes).toBe("scope.one scope.two")
  })

  it("google OAuth-only provider still uses GOOGLE_SCOPES", () => {
    setGoogleCredentials()
    process.env.GOOGLE_SCOPES = "scope.alpha scope.beta"

    const config = getOAuthConfig("google", baseUrl)

    expect(config).not.toBeNull()
    expect(config?.scopes).toBe("scope.alpha scope.beta")
  })
})
