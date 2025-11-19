import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { isPortListening, MIN_PORT, MAX_PORT } from "../src/ports"

describe("Port Management", () => {
  describe("isPortListening", () => {
    it("should return false for non-listening ports", async () => {
      // Use a high port that's unlikely to be in use
      const result = await isPortListening(65432)
      expect(result).toBe(false)
    })

    it("should timeout within reasonable time", async () => {
      const start = Date.now()
      await isPortListening(65433)
      const elapsed = Date.now() - start
      // Should timeout after ~100ms (socket timeout)
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe("Port Constants", () => {
    it("should have valid port range", () => {
      expect(MIN_PORT).toBe(3333)
      expect(MAX_PORT).toBe(3999)
      expect(MIN_PORT).toBeLessThan(MAX_PORT)
    })
  })
})
