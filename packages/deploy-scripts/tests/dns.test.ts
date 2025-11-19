import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { isCloudflareIP, shouldSkipDNSValidation, WILDCARD_DOMAIN } from "../src/dns"

describe("DNS Validation", () => {
  describe("isCloudflareIP", () => {
    it("should identify Cloudflare IPs", () => {
      const cloudflareIPs = [
        "104.16.0.1",
        "104.19.255.1",
        "104.20.0.1",
        "104.24.0.1",
        "172.64.0.1",
        "172.67.0.1",
        "173.245.48.1",
        "188.114.96.1",
        "190.93.240.1",
        "197.234.240.1",
        "198.41.200.1",
      ]

      cloudflareIPs.forEach((ip) => {
        expect(isCloudflareIP(ip)).toBe(true)
      })
    })

    it("should not identify non-Cloudflare IPs", () => {
      const nonCloudflareIPs = ["8.8.8.8", "1.1.1.1", "138.201.56.93"]

      nonCloudflareIPs.forEach((ip) => {
        expect(isCloudflareIP(ip)).toBe(false)
      })
    })
  })

  describe("shouldSkipDNSValidation", () => {
    it("should skip validation for wildcard domains", () => {
      expect(shouldSkipDNSValidation(`test.${WILDCARD_DOMAIN}`)).toBe(true)
      expect(shouldSkipDNSValidation(`mysite.${WILDCARD_DOMAIN}`)).toBe(true)
    })

    it("should not skip validation for custom domains", () => {
      expect(shouldSkipDNSValidation("example.com")).toBe(false)
      expect(shouldSkipDNSValidation("mysite.io")).toBe(false)
    })
  })
})
