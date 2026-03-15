import { describe, expect, it, vi } from "vitest"

/**
 * Unit tests for preview-utils.ts
 *
 * Tests the actual exported functions. We mock @webalive/env/client
 * to control NEXT_PUBLIC_PREVIEW_BASE without needing real env vars.
 */

vi.mock("@webalive/env/client", () => ({
  env: {
    NEXT_PUBLIC_PREVIEW_BASE: "test.example",
  },
}))

import {
  domainToPreviewLabel,
  extractWorkspaceFromPreviewHost,
  getPreviewUrl,
  getSiteUrl,
  isPreviewHost,
  previewLabelToDomain,
} from "../preview-utils"

describe("preview-utils", () => {
  describe("domainToPreviewLabel", () => {
    it("converts dots to dashes", () => {
      expect(domainToPreviewLabel("mysite.test.example")).toBe("mysite-test-example")
    })

    it("handles single-part domain", () => {
      expect(domainToPreviewLabel("localhost")).toBe("localhost")
    })

    it("handles multi-level domain", () => {
      expect(domainToPreviewLabel("my.deep.site.test.example")).toBe("my-deep-site-test-example")
    })
  })

  describe("previewLabelToDomain", () => {
    it("converts dashes to dots", () => {
      expect(previewLabelToDomain("mysite-test-example")).toBe("mysite.test.example")
    })

    it("handles single-part label", () => {
      expect(previewLabelToDomain("localhost")).toBe("localhost")
    })
  })

  describe("isPreviewHost", () => {
    it("detects preview hosts", () => {
      expect(isPreviewHost("preview--mysite-test-example.test.example")).toBe(true)
    })

    it("rejects normal hosts", () => {
      expect(isPreviewHost("mysite.test.example")).toBe(false)
    })

    it("rejects partial prefix", () => {
      expect(isPreviewHost("preview-mysite.test.example")).toBe(false)
    })
  })

  describe("extractWorkspaceFromPreviewHost", () => {
    it("extracts workspace from valid preview host", () => {
      expect(extractWorkspaceFromPreviewHost("preview--mysite-test-example.test.example")).toBe("mysite.test.example")
    })

    it("returns null for non-preview host", () => {
      expect(extractWorkspaceFromPreviewHost("mysite.test.example")).toBeNull()
    })

    it("returns null for wrong wildcard suffix", () => {
      // Host uses wrong.tld instead of test.example — suffix mismatch
      expect(extractWorkspaceFromPreviewHost("preview--mysite-test-example.wrong.tld")).toBeNull()
    })

    it("returns null for empty label", () => {
      expect(extractWorkspaceFromPreviewHost("preview--.test.example")).toBeNull()
    })

    it("returns null for missing prefix", () => {
      expect(extractWorkspaceFromPreviewHost("anything.test.example")).toBeNull()
    })

    it("handles label with multiple dashes (multi-level domain)", () => {
      expect(extractWorkspaceFromPreviewHost("preview--a-b-c-test-example.test.example")).toBe("a.b.c.test.example")
    })
  })

  describe("getPreviewUrl", () => {
    it("generates basic preview URL", () => {
      expect(getPreviewUrl("mysite.test.example")).toBe("https://preview--mysite-test-example.test.example/")
    })

    it("includes path", () => {
      expect(getPreviewUrl("mysite.test.example", { path: "/about" })).toBe(
        "https://preview--mysite-test-example.test.example/about",
      )
    })

    it("appends token as query param", () => {
      const url = getPreviewUrl("mysite.test.example", { path: "/", token: "abc123" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("preview_token")).toBe("abc123")
      expect(parsed.pathname).toBe("/")
    })

    it("handles path with existing query params (no double ?)", () => {
      const url = getPreviewUrl("mysite.test.example", { path: "/page?x=1&y=2", token: "tok" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("x")).toBe("1")
      expect(parsed.searchParams.get("y")).toBe("2")
      expect(parsed.searchParams.get("preview_token")).toBe("tok")
      // No double "?" in the raw URL
      expect(url.split("?").length).toBe(2)
    })

    it("handles path with hash — token placed before hash", () => {
      const url = getPreviewUrl("mysite.test.example", { path: "/page#section", token: "tok" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("preview_token")).toBe("tok")
      expect(parsed.hash).toBe("#section")
      // Token must come before hash in the raw URL (otherwise server won't see it)
      const tokenIdx = url.indexOf("preview_token")
      const hashIdx = url.indexOf("#section")
      expect(tokenIdx).toBeLessThan(hashIdx)
    })

    it("handles path with query and hash combined", () => {
      const url = getPreviewUrl("mysite.test.example", { path: "/page?q=test#results", token: "tok" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("q")).toBe("test")
      expect(parsed.searchParams.get("preview_token")).toBe("tok")
      expect(parsed.hash).toBe("#results")
    })

    it("returns clean URL without token when token is undefined", () => {
      const url = getPreviewUrl("mysite.test.example", { path: "/page?x=1#section" })
      expect(url).toBe("https://preview--mysite-test-example.test.example/page?x=1#section")
    })

    it("normalizes path without leading slash", () => {
      expect(getPreviewUrl("mysite.test.example", { path: "about" })).toBe(
        "https://preview--mysite-test-example.test.example/about",
      )
    })
  })

  describe("getSiteUrl", () => {
    it("generates basic site URL", () => {
      expect(getSiteUrl("mysite.test.example")).toBe("https://mysite.test.example/")
    })

    it("includes path", () => {
      expect(getSiteUrl("mysite.test.example", "/about")).toBe("https://mysite.test.example/about")
    })
  })

  describe("round-trip: domainToPreviewLabel ↔ previewLabelToDomain", () => {
    it("round-trips a dot-only domain", () => {
      const domain = "mysite.test.example"
      expect(previewLabelToDomain(domainToPreviewLabel(domain))).toBe(domain)
    })

    it("domain with literal dashes is lossy (known limitation)", () => {
      // A domain like "my-site.test.example" contains a real dash.
      // domainToPreviewLabel converts dots→dashes: "my-site-test-example"
      // previewLabelToDomain converts ALL dashes→dots: "my.site.test.example"
      // This is lossy — the round-trip does NOT recover the original.
      const domain = "my-site.test.example"
      const label = domainToPreviewLabel(domain)
      expect(label).toBe("my-site-test-example")
      expect(previewLabelToDomain(label)).toBe("my.site.test.example")
      expect(previewLabelToDomain(label)).not.toBe(domain) // lossy!
    })
  })
})
