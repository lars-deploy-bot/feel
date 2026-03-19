import { describe, expect, it } from "vitest"
import {
  getAllOAuthProviderKeys,
  getOAuthKeyForProvider,
  getOAuthMcpProviderConfig,
  getOAuthMcpProviderKeys,
  isOAuthMcpTool,
  isValidOAuthProviderKey,
  OAUTH_MCP_PROVIDERS,
  OAUTH_ONLY_PROVIDERS,
  providerSupportsOAuth,
  providerSupportsPat,
} from "../mcp-providers"

describe("Outlook provider metadata", () => {
  it("outlook exists in OAUTH_MCP_PROVIDERS", () => {
    expect(OAUTH_MCP_PROVIDERS).toHaveProperty("outlook")
  })

  it("outlook uses microsoft as oauthKey", () => {
    expect(OAUTH_MCP_PROVIDERS.outlook.oauthKey).toBe("microsoft")
  })

  it("outlook has correct envPrefix", () => {
    expect(OAUTH_MCP_PROVIDERS.outlook.envPrefix).toBe("MICROSOFT")
  })

  it("outlook has Microsoft Graph scopes", () => {
    expect(OAUTH_MCP_PROVIDERS.outlook.defaultScopes).toContain("https://graph.microsoft.com/Mail.ReadWrite")
    expect(OAUTH_MCP_PROVIDERS.outlook.defaultScopes).toContain("https://graph.microsoft.com/Mail.Send")
    expect(OAUTH_MCP_PROVIDERS.outlook.defaultScopes).toContain("https://graph.microsoft.com/User.Read")
  })

  it("outlook has expected tool names", () => {
    const tools = OAUTH_MCP_PROVIDERS.outlook.knownTools
    expect(tools).toBeDefined()
    expect(tools).toContain("mcp__outlook__compose_email")
    expect(tools).toContain("mcp__outlook__search_emails")
    expect(tools).toContain("mcp__outlook__get_email")
  })
})

describe("Microsoft OAuth-only provider", () => {
  it("microsoft exists in OAUTH_ONLY_PROVIDERS", () => {
    expect(OAUTH_ONLY_PROVIDERS).toHaveProperty("microsoft")
  })

  it("microsoft has Microsoft Graph scopes without offline_access", () => {
    expect(OAUTH_ONLY_PROVIDERS.microsoft.defaultScopes).toContain("https://graph.microsoft.com/Mail.ReadWrite")
    // offline_access is NOT a resource scope — it's a request-time hint for refresh tokens.
    // Microsoft doesn't echo it in the token response, so it must not be in defaultScopes
    // or callback validation will always report missing_required_scopes.
    expect(OAUTH_ONLY_PROVIDERS.microsoft.defaultScopes).not.toContain("offline_access")
  })

  it("microsoft has correct envPrefix", () => {
    expect(OAUTH_ONLY_PROVIDERS.microsoft.envPrefix).toBe("MICROSOFT")
  })
})

describe("OAuth key mapping for Outlook", () => {
  it("getOAuthKeyForProvider returns microsoft for outlook", () => {
    expect(getOAuthKeyForProvider("outlook")).toBe("microsoft")
  })

  it("keeps gmail on google and isolates google_calendar", () => {
    expect(getOAuthKeyForProvider("gmail")).toBe("google")
    expect(getOAuthKeyForProvider("google_calendar")).toBe("google_calendar")
    expect(getOAuthKeyForProvider("outlook")).toBe("microsoft")
  })
})

describe("type guards include outlook", () => {
  it("outlook is an MCP provider key", () => {
    expect("outlook" in OAUTH_MCP_PROVIDERS).toBe(true)
  })

  it("isValidOAuthProviderKey recognizes both outlook and microsoft", () => {
    expect(isValidOAuthProviderKey("outlook")).toBe(true)
    expect(isValidOAuthProviderKey("microsoft")).toBe(true)
  })

  it("getOAuthMcpProviderKeys includes outlook", () => {
    expect(getOAuthMcpProviderKeys()).toContain("outlook")
  })

  it("getAllOAuthProviderKeys includes both outlook and microsoft", () => {
    const keys = getAllOAuthProviderKeys()
    expect(keys).toContain("outlook")
    expect(keys).toContain("microsoft")
  })
})

describe("getOAuthMcpProviderConfig for outlook", () => {
  it("returns outlook config", () => {
    const config = getOAuthMcpProviderConfig("outlook")
    expect(config).toBeDefined()
    expect(config!.friendlyName).toBe("Outlook")
    expect(config!.oauthKey).toBe("microsoft")
  })
})

describe("isOAuthMcpTool for outlook tools", () => {
  it("recognizes outlook tools when connected", () => {
    expect(isOAuthMcpTool("mcp__outlook__search_emails", new Set(["outlook"]))).toBe(true)
  })

  it("rejects outlook tools when not connected", () => {
    expect(isOAuthMcpTool("mcp__outlook__search_emails", new Set(["gmail"]))).toBe(false)
  })
})

describe("outlook auth support flags", () => {
  it("providerSupportsPat returns false for outlook", () => {
    expect(providerSupportsPat("outlook")).toBe(false)
  })

  it("providerSupportsOAuth returns true for outlook", () => {
    expect(providerSupportsOAuth("outlook")).toBe(true)
  })

  it("providerSupportsOAuth returns true for microsoft (OAuth-only provider)", () => {
    expect(providerSupportsOAuth("microsoft")).toBe(true)
  })
})

describe("GitHub is OAuth-only (no MCP server)", () => {
  it("github is NOT in OAUTH_MCP_PROVIDERS", () => {
    expect(OAUTH_MCP_PROVIDERS).not.toHaveProperty("github")
  })

  it("github IS in OAUTH_ONLY_PROVIDERS", () => {
    expect(OAUTH_ONLY_PROVIDERS).toHaveProperty("github")
    expect(OAUTH_ONLY_PROVIDERS.github.friendlyName).toBe("GitHub")
    expect(OAUTH_ONLY_PROVIDERS.github.envPrefix).toBe("GITHUB")
  })

  it("github is not an MCP provider key", () => {
    expect("github" in OAUTH_MCP_PROVIDERS).toBe(false)
  })

  it("isValidOAuthProviderKey still accepts github", () => {
    expect(isValidOAuthProviderKey("github")).toBe(true)
  })

  it("getAllOAuthProviderKeys still includes github", () => {
    expect(getAllOAuthProviderKeys()).toContain("github")
  })

  it("getOAuthKeyForProvider returns github for github", () => {
    expect(getOAuthKeyForProvider("github")).toBe("github")
  })

  it("providerSupportsPat returns true for github", () => {
    expect(providerSupportsPat("github")).toBe(true)
  })

  it("providerSupportsOAuth returns true for github", () => {
    expect(providerSupportsOAuth("github")).toBe(true)
  })

  it("mcp__github__ tools are NOT recognized as valid MCP tools", () => {
    expect(isOAuthMcpTool("mcp__github__list_repos", new Set(["github"]))).toBe(false)
  })
})

describe("existing providers unchanged", () => {
  it("gmail still maps to google", () => {
    expect(OAUTH_MCP_PROVIDERS.gmail.oauthKey).toBe("google")
  })

  it("google_calendar uses its own oauth key", () => {
    expect(OAUTH_MCP_PROVIDERS.google_calendar.oauthKey).toBe("google_calendar")
  })

  it("stripe still maps to stripe", () => {
    expect(OAUTH_MCP_PROVIDERS.stripe.oauthKey).toBe("stripe")
  })

  it("google still exists in OAUTH_ONLY_PROVIDERS", () => {
    expect(OAUTH_ONLY_PROVIDERS.google.envPrefix).toBe("GOOGLE")
  })
})
