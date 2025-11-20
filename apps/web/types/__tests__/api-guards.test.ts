import { describe, expect, it } from "vitest"
import { BodySchema, LoginSchema } from "@/types/guards/api"

describe("API Request Validation Guards", () => {
  describe("BodySchema (Claude API request)", () => {
    it("should accept valid request body", () => {
      const validBody = {
        message: "Hello Claude",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        workspace: "example.com",
      }

      const result = BodySchema.safeParse(validBody)
      expect(result.success).toBe(true)
    })

    const validUuid = "550e8400-e29b-41d4-a716-446655440000"

    it("should require message field", () => {
      const invalidBody = {
        conversationId: validUuid,
      }

      const result = BodySchema.safeParse(invalidBody)
      expect(result.success).toBe(false)
    })

    it("should reject empty messages", () => {
      const invalidBody = {
        message: "",
        conversationId: validUuid,
      }

      const result = BodySchema.safeParse(invalidBody)
      expect(result.success).toBe(false)
    })

    it("should reject non-string messages", () => {
      const invalidBodies = [
        { message: 123, conversationId: validUuid },
        { message: null, conversationId: validUuid },
        { message: undefined, conversationId: validUuid },
        { message: {}, conversationId: validUuid },
      ]

      for (const body of invalidBodies) {
        const result = BodySchema.safeParse(body)
        expect(result.success, `Should reject: ${JSON.stringify(body)}`).toBe(false)
      }
    })

    it("should require conversationId", () => {
      const invalidBody = {
        message: "Hello",
      }

      const result = BodySchema.safeParse(invalidBody)
      expect(result.success).toBe(false)
    })

    it("should require conversationId to be valid UUID", () => {
      const invalidIds = [
        { message: "Hello", conversationId: "not-a-uuid" },
        { message: "Hello", conversationId: "12345" },
        { message: "Hello", conversationId: "" },
      ]

      for (const body of invalidIds) {
        const result = BodySchema.safeParse(body)
        expect(result.success, `Should reject invalid UUID: ${body.conversationId}`).toBe(false)
      }
    })

    it("should accept optional workspace parameter", () => {
      const withWorkspace = {
        message: "Hello",
        conversationId: validUuid,
        workspace: "example.com",
      }

      const withoutWorkspace = {
        message: "Hello",
        conversationId: validUuid,
      }

      expect(BodySchema.safeParse(withWorkspace).success).toBe(true)
      expect(BodySchema.safeParse(withoutWorkspace).success).toBe(true)
    })

    it("should handle extremely long messages without crashing", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const tooLong = {
        message: "a".repeat(1_000_001),
        conversationId: validUuid,
      }

      expect(() => BodySchema.safeParse(tooLong)).not.toThrow()
    })

    it("should accept messages with special characters", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const specialMessages = [
        { message: "<script>alert('xss')</script>", conversationId: validUuid },
        { message: "'; DROP TABLE users; --", conversationId: validUuid },
        { message: "test\x00null", conversationId: validUuid },
      ]

      for (const body of specialMessages) {
        expect(() => BodySchema.safeParse(body)).not.toThrow()
      }
    })
  })

  describe("LoginSchema", () => {
    it("should accept valid login credentials", () => {
      const validLogin = {
        passcode: "supersecret",
        workspace: "example.com",
      }

      const result = LoginSchema.safeParse(validLogin)
      expect(result.success).toBe(true)
    })

    it("should accept missing optional fields", () => {
      const onlyPasscode = { passcode: "supersecret" }
      const onlyWorkspace = { workspace: "example.com" }
      const emptyObject = {}

      expect(LoginSchema.safeParse(onlyPasscode).success).toBe(true)
      expect(LoginSchema.safeParse(onlyWorkspace).success).toBe(true)
      expect(LoginSchema.safeParse(emptyObject).success).toBe(true)
    })

    it("should reject non-string when provided", () => {
      const invalidLogins = [{ passcode: 123 }, { workspace: 456 }, { passcode: null }, { workspace: null }]

      for (const login of invalidLogins) {
        const result = LoginSchema.safeParse(login)
        expect(result.success, `Should reject: ${JSON.stringify(login)}`).toBe(false)
      }
    })

    it("should accept string values for workspace", () => {
      const sqlInjection = {
        passcode: "supersecret",
        workspace: "example.com'; DROP TABLE users; --",
      }

      const result = LoginSchema.safeParse(sqlInjection)
      expect(result.success).toBe(true)
    })

    it("should accept any string for workspace field", () => {
      const pathTraversal = {
        passcode: "supersecret",
        workspace: "../../etc/passwd",
      }

      const result = LoginSchema.safeParse(pathTraversal)
      expect(result.success).toBe(true)
    })
  })

  describe("Request Sanitization", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000"

    it("should strip unexpected fields from valid requests", () => {
      const bodyWithExtra = {
        message: "Hello",
        conversationId: validUuid,
        extraField: "should be stripped",
      }

      const result = BodySchema.safeParse(bodyWithExtra)
      if (result.success) {
        expect(result.data).not.toHaveProperty("extraField")
      }
    })

    it("should handle null prototype objects", () => {
      const nullProtoBody = Object.create(null)
      nullProtoBody.message = "Hello"
      nullProtoBody.conversationId = validUuid

      expect(() => BodySchema.safeParse(nullProtoBody)).not.toThrow()
    })

    it("should handle circular references without crashing", () => {
      interface CircularBody {
        message: string
        conversationId: string
        self?: CircularBody
      }

      const circular: CircularBody = {
        message: "Hello",
        conversationId: validUuid,
      }
      circular.self = circular

      expect(() => BodySchema.safeParse(circular)).not.toThrow()
    })
  })

  describe("Performance & DoS Prevention", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000"

    it("should handle deeply nested objects without stack overflow", () => {
      interface DeepObject {
        message?: string
        conversationId?: string
        nested?: DeepObject
      }

      let deepObject: DeepObject = { message: "Hello", conversationId: validUuid }
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject }
      }

      expect(() => BodySchema.safeParse(deepObject)).not.toThrow()
    })

    it("should handle large objects efficiently", () => {
      const largeObject = {
        message: "Hello",
        conversationId: validUuid,
        extra: Array(1000).fill("item"),
      }

      const start = Date.now()
      BodySchema.safeParse(largeObject)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000)
    })
  })
})
