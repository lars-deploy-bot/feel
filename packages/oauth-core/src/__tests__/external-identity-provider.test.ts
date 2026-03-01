import { describe, expect, it } from "vitest"
import { isExternalIdentityProvider } from "../providers/base"
import { GitHubProvider } from "../providers/github"
import { GoogleProvider } from "../providers/google"
import { LinearProvider } from "../providers/linear"
import { StripeProvider } from "../providers/stripe"

describe("ExternalIdentityProvider type guard", () => {
  it("returns true for GoogleProvider (has getUserInfo)", () => {
    const google = new GoogleProvider()
    expect(isExternalIdentityProvider(google)).toBe(true)
  })

  it("returns true for LinearProvider (has getUserInfo)", () => {
    const linear = new LinearProvider()
    expect(isExternalIdentityProvider(linear)).toBe(true)
  })

  it("returns false for GitHubProvider (no getUserInfo)", () => {
    const github = new GitHubProvider()
    expect(isExternalIdentityProvider(github)).toBe(false)
  })

  it("returns false for StripeProvider (has getAccountInfo, not getUserInfo)", () => {
    const stripe = new StripeProvider()
    expect(isExternalIdentityProvider(stripe)).toBe(false)
  })
})
