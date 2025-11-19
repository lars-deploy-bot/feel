import { describe, it, expect } from "bun:test"
import { generateCaddyfileBlock } from "../src/caddy"

describe("Caddy Configuration", () => {
  describe("generateCaddyfileBlock", () => {
    it("should generate a valid Caddyfile block", () => {
      const block = generateCaddyfileBlock("example.com", 3333)
      expect(block).toContain("example.com")
      expect(block).toContain("3333")
      expect(block).toContain("reverse_proxy localhost:3333")
    })

    it("should include required directives", () => {
      const block = generateCaddyfileBlock("test.io", 3334)
      expect(block).toContain("import common_headers")
      expect(block).toContain("import image_serving")
      expect(block).toContain("header_up Host")
      expect(block).toContain("header_up X-Real-IP")
      expect(block).toContain("header_up X-Forwarded-For")
      expect(block).toContain("header_up X-Forwarded-Proto")
    })

    it("should contain comment with domain and port", () => {
      const block = generateCaddyfileBlock("example.com", 3333)
      expect(block).toContain("# Auto-generated Caddyfile for example.com")
      expect(block).toContain("# Port: 3333")
    })

    it("should handle different port numbers", () => {
      const block1 = generateCaddyfileBlock("site1.com", 3333)
      const block2 = generateCaddyfileBlock("site2.com", 3999)

      expect(block1).toContain("localhost:3333")
      expect(block2).toContain("localhost:3999")
    })
  })
})
