import { describe, it, expect } from "bun:test"
import { domainToSlug, getSiteUsername } from "../src/users"

describe("User Management", () => {
  describe("domainToSlug", () => {
    it("should convert domains to slugs", () => {
      expect(domainToSlug("example.com")).toBe("example-com")
      expect(domainToSlug("my-site.io")).toBe("my-site-io")
      expect(domainToSlug("test.co.uk")).toBe("test-co-uk")
    })

    it("should lowercase the result", () => {
      expect(domainToSlug("EXAMPLE.COM")).toBe("example-com")
      expect(domainToSlug("MyDomain.IO")).toBe("mydomain-io")
    })

    it("should remove special characters", () => {
      expect(domainToSlug("my@site.com")).toBe("my-site-com")
      expect(domainToSlug("test_domain.io")).toBe("test-domain-io")
    })
  })

  describe("getSiteUsername", () => {
    it("should generate site username", () => {
      expect(getSiteUsername("example.com")).toBe("site-example-com")
      expect(getSiteUsername("my-site.io")).toBe("site-my-site-io")
    })

    it("should be consistent with domainToSlug", () => {
      const domain = "test.example.com"
      const expected = `site-${domainToSlug(domain)}`
      expect(getSiteUsername(domain)).toBe(expected)
    })
  })
})
