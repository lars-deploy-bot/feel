import { describe, expect, it, vi } from "vitest"

/**
 * Unit tests for preview-utils.ts
 *
 * Tests the actual exported functions. We mock @webalive/env/client
 * to control NEXT_PUBLIC_PREVIEW_BASE without needing real env vars.
 */

vi.mock("@webalive/env/client", () => ({
  env: {
    NEXT_PUBLIC_PREVIEW_BASE: "sonno.tech",
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
      expect(domainToPreviewLabel("protino.sonno.tech")).toBe("protino-sonno-tech")
    })

    it("handles single-part domain", () => {
      expect(domainToPreviewLabel("localhost")).toBe("localhost")
    })

    it("handles multi-level domain", () => {
      expect(domainToPreviewLabel("my.deep.site.alive.best")).toBe("my-deep-site-alive-best")
    })
  })

  describe("previewLabelToDomain", () => {
    it("converts dashes to dots", () => {
      expect(previewLabelToDomain("protino-sonno-tech")).toBe("protino.sonno.tech")
    })

    it("handles single-part label", () => {
      expect(previewLabelToDomain("localhost")).toBe("localhost")
    })
  })

  describe("isPreviewHost", () => {
    it("detects preview hosts", () => {
      expect(isPreviewHost("preview--protino-sonno-tech.sonno.tech")).toBe(true)
    })

    it("rejects normal hosts", () => {
      expect(isPreviewHost("protino.sonno.tech")).toBe(false)
    })

    it("rejects partial prefix", () => {
      expect(isPreviewHost("preview-protino.sonno.tech")).toBe(false)
    })
  })

  describe("extractWorkspaceFromPreviewHost", () => {
    it("extracts workspace from valid preview host", () => {
      expect(extractWorkspaceFromPreviewHost("preview--protino-sonno-tech.sonno.tech")).toBe("protino.sonno.tech")
    })

    it("returns null for non-preview host", () => {
      expect(extractWorkspaceFromPreviewHost("protino.sonno.tech")).toBeNull()
    })

    it("returns null for wrong wildcard suffix", () => {
      expect(extractWorkspaceFromPreviewHost("preview--protino-alive-best.alive.best")).toBeNull()
    })

    it("returns null for empty label", () => {
      expect(extractWorkspaceFromPreviewHost("preview--.sonno.tech")).toBeNull()
    })

    it("returns null for missing prefix", () => {
      expect(extractWorkspaceFromPreviewHost("anything.sonno.tech")).toBeNull()
    })

    it("handles label with multiple dashes (multi-level domain)", () => {
      expect(extractWorkspaceFromPreviewHost("preview--a-b-c-sonno-tech.sonno.tech")).toBe("a.b.c.sonno.tech")
    })
  })

  describe("getPreviewUrl", () => {
    it("generates basic preview URL", () => {
      expect(getPreviewUrl("protino.sonno.tech")).toBe("https://preview--protino-sonno-tech.sonno.tech/")
    })

    it("includes path", () => {
      expect(getPreviewUrl("protino.sonno.tech", { path: "/about" })).toBe(
        "https://preview--protino-sonno-tech.sonno.tech/about",
      )
    })

    it("appends token as query param", () => {
      const url = getPreviewUrl("protino.sonno.tech", { path: "/", token: "abc123" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("preview_token")).toBe("abc123")
      expect(parsed.pathname).toBe("/")
    })

    it("handles path with existing query params (no double ?)", () => {
      const url = getPreviewUrl("protino.sonno.tech", { path: "/page?x=1&y=2", token: "tok" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("x")).toBe("1")
      expect(parsed.searchParams.get("y")).toBe("2")
      expect(parsed.searchParams.get("preview_token")).toBe("tok")
      // No double "?" in the raw URL
      expect(url.split("?").length).toBe(2)
    })

    it("handles path with hash — token placed before hash", () => {
      const url = getPreviewUrl("protino.sonno.tech", { path: "/page#section", token: "tok" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("preview_token")).toBe("tok")
      expect(parsed.hash).toBe("#section")
      // Token must come before hash in the raw URL (otherwise server won't see it)
      const tokenIdx = url.indexOf("preview_token")
      const hashIdx = url.indexOf("#section")
      expect(tokenIdx).toBeLessThan(hashIdx)
    })

    it("handles path with query and hash combined", () => {
      const url = getPreviewUrl("protino.sonno.tech", { path: "/page?q=test#results", token: "tok" })
      const parsed = new URL(url)
      expect(parsed.searchParams.get("q")).toBe("test")
      expect(parsed.searchParams.get("preview_token")).toBe("tok")
      expect(parsed.hash).toBe("#results")
    })

    it("returns clean URL without token when token is undefined", () => {
      const url = getPreviewUrl("protino.sonno.tech", { path: "/page?x=1#section" })
      expect(url).toBe("https://preview--protino-sonno-tech.sonno.tech/page?x=1#section")
    })

    it("normalizes path without leading slash", () => {
      expect(getPreviewUrl("protino.sonno.tech", { path: "about" })).toBe(
        "https://preview--protino-sonno-tech.sonno.tech/about",
      )
    })
  })

  describe("getSiteUrl", () => {
    it("generates basic site URL", () => {
      expect(getSiteUrl("protino.sonno.tech")).toBe("https://protino.sonno.tech/")
    })

    it("includes path", () => {
      expect(getSiteUrl("protino.sonno.tech", "/about")).toBe("https://protino.sonno.tech/about")
    })
  })

  describe("round-trip: domainToPreviewLabel ↔ previewLabelToDomain", () => {
    it("round-trips a dot-only domain", () => {
      const domain = "protino.sonno.tech"
      expect(previewLabelToDomain(domainToPreviewLabel(domain))).toBe(domain)
    })

    it("domain with literal dashes is lossy (known limitation)", () => {
      // A domain like "my-site.alive.best" contains a real dash.
      // domainToPreviewLabel converts dots→dashes: "my-site-alive-best"
      // previewLabelToDomain converts ALL dashes→dots: "my.site.alive.best"
      // This is lossy — the round-trip does NOT recover the original.
      const domain = "my-site.alive.best"
      const label = domainToPreviewLabel(domain)
      expect(label).toBe("my-site-alive-best")
      expect(previewLabelToDomain(label)).toBe("my.site.alive.best")
      expect(previewLabelToDomain(label)).not.toBe(domain) // lossy!
    })
  })
})
