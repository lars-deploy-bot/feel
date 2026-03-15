import { describe, expect, it } from "vitest"
import { scopeAutomationSitesForForm } from "../src/tools/ai/ask-automation-config.js"

const SITES = [
  { id: "site_1", hostname: "huurmatcher.test.example" },
  { id: "site_2", hostname: "other.test.example" },
]

describe("scopeAutomationSitesForForm", () => {
  it("scopes to explicit defaultSiteId when provided", () => {
    const result = scopeAutomationSitesForForm({
      sites: SITES,
      defaultSiteId: "site_2",
      workspaceHostname: "huurmatcher.test.example",
    })

    expect(result).toEqual({
      sites: [{ id: "site_2", hostname: "other.test.example" }],
      defaultSiteId: "site_2",
    })
  })

  it("scopes to current workspace hostname when no defaultSiteId is provided", () => {
    const result = scopeAutomationSitesForForm({
      sites: SITES,
      workspaceHostname: "huurmatcher.test.example",
    })

    expect(result).toEqual({
      sites: [{ id: "site_1", hostname: "huurmatcher.test.example" }],
      defaultSiteId: "site_1",
    })
  })

  it("falls back to workspace hostname when defaultSiteId is invalid", () => {
    const result = scopeAutomationSitesForForm({
      sites: SITES,
      defaultSiteId: "does_not_exist",
      workspaceHostname: "other.test.example",
    })

    expect(result).toEqual({
      sites: [{ id: "site_2", hostname: "other.test.example" }],
      defaultSiteId: "site_2",
    })
  })

  it("returns all sites unchanged when no scope can be derived", () => {
    const result = scopeAutomationSitesForForm({
      sites: SITES,
      defaultSiteId: "does_not_exist",
      workspaceHostname: "unknown.test.example",
    })

    expect(result).toEqual({
      sites: SITES,
      defaultSiteId: undefined,
    })
  })

  it("defaults to the only site when the user only has one", () => {
    const singleSite = [{ id: "site_1", hostname: "huurmatcher.test.example" }]

    const result = scopeAutomationSitesForForm({
      sites: singleSite,
      defaultSiteId: "does_not_exist",
      workspaceHostname: "unknown.test.example",
    })

    expect(result).toEqual({
      sites: singleSite,
      defaultSiteId: "site_1",
    })
  })
})
