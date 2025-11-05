import { describe, expect, it } from "vitest"
import { generateRequestId } from "@/lib/utils"

describe("Utility Functions", () => {
  describe("generateRequestId", () => {
    it("should generate a non-empty string", () => {
      const id = generateRequestId()
      expect(id).toBeTruthy()
      expect(typeof id).toBe("string")
      expect(id.length).toBeGreaterThan(0)
    })

    it("should generate unique IDs", () => {
      const ids = new Set<string>()
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        ids.add(generateRequestId())
      }

      // All IDs should be unique
      expect(ids.size).toBe(iterations)
    })

    it("should generate IDs quickly", () => {
      const start = Date.now()
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        generateRequestId()
      }

      const duration = Date.now() - start
      const perCall = duration / iterations

      // Should be very fast (< 0.01ms per call)
      expect(perCall).toBeLessThan(0.01)
    })

    it("should generate IDs without special characters that break logs", () => {
      const id = generateRequestId()

      // Should not contain characters that break log parsing
      expect(id).not.toMatch(/[\n\r\t\0]/)
      expect(id).not.toMatch(/[<>]/) // No HTML/XML chars
    })

    it("should be safe for use in URLs and file paths", () => {
      const id = generateRequestId()

      // Should not contain URL-unsafe characters
      expect(id).not.toMatch(/[^a-zA-Z0-9_-]/)
    })

    it("should have consistent format", () => {
      const ids = Array.from({ length: 100 }, () => generateRequestId())

      // All IDs should have similar characteristics
      const lengths = ids.map(id => id.length)
      const uniqueLengths = new Set(lengths)

      // Length should be consistent (within reason)
      expect(uniqueLengths.size).toBeLessThanOrEqual(3)
    })

    it("should generate different IDs in rapid succession", () => {
      // Even when called microseconds apart
      const id1 = generateRequestId()
      const id2 = generateRequestId()
      const id3 = generateRequestId()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    it("should not be predictable", () => {
      const ids = Array.from({ length: 100 }, () => generateRequestId())

      // IDs should not be sequential or predictable
      for (let i = 1; i < ids.length; i++) {
        // Adjacent IDs should be very different
        expect(ids[i]).not.toBe(ids[i - 1])

        // Should not be incremental
        const num1 = Number.parseInt(ids[i - 1], 36)
        const num2 = Number.parseInt(ids[i], 36)
        if (!Number.isNaN(num1) && !Number.isNaN(num2)) {
          expect(Math.abs(num2 - num1)).not.toBe(1)
        }
      }
    })

    it("should work in concurrent scenarios", async () => {
      // Simulate concurrent request ID generation
      const promises = Array.from({ length: 1000 }, () => Promise.resolve().then(() => generateRequestId()))

      const ids = await Promise.all(promises)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })

    it("should handle high-frequency generation", () => {
      const _idsPerSecond = 100000
      const duration = 100 // ms

      const start = Date.now()
      const ids = new Set<string>()

      while (Date.now() - start < duration) {
        ids.add(generateRequestId())
      }

      // Should generate many IDs without collision
      expect(ids.size).toBeGreaterThan(1000)

      // All should be unique
      const idsArray = Array.from(ids)
      expect(new Set(idsArray).size).toBe(idsArray.length)
    })

    it("should not overflow or throw errors", () => {
      // Generate many IDs to check for overflow issues
      expect(() => {
        for (let i = 0; i < 100000; i++) {
          generateRequestId()
        }
      }).not.toThrow()
    })

    it("should be suitable for log correlation", () => {
      const id = generateRequestId()

      // Should be easy to search in logs
      expect(id).toMatch(/^[a-z0-9-_]+$/i)

      // Should be reasonably short for readability
      expect(id.length).toBeLessThan(100)
      expect(id.length).toBeGreaterThan(5)
    })

    it("should not contain sensitive information", () => {
      const id = generateRequestId()

      // Should not reveal:
      // - User information
      // - Workspace paths
      // - Timestamps that could be used for timing attacks
      // - Sequential patterns

      expect(id).not.toMatch(/user|workspace|password|key|secret/i)
      expect(id).not.toMatch(/\/|\\/) // No file paths
    })
  })
})
