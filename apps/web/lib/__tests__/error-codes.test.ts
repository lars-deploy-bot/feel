import { describe, expect, it } from "vitest"
import { ErrorCodes, getErrorHelp, getErrorMessage, isWorkspaceError } from "@/lib/error-codes"

describe("Error Code Registry", () => {
  describe("getErrorMessage", () => {
    it("should return a message for every ErrorCode", () => {
      const allErrorCodes = Object.values(ErrorCodes)

      for (const code of allErrorCodes) {
        const message = getErrorMessage(code)
        expect(message, `ErrorCode ${code} should have a message`).toBeTruthy()
        expect(message.length, `ErrorCode ${code} message should be non-empty`).toBeGreaterThan(0)
      }
    })

    it("should return concise user-friendly messages", () => {
      const message = getErrorMessage(ErrorCodes.FILE_READ_ERROR)
      expect(message).toMatch(/can't read/i)
    })

    it("should support dynamic details in messages", () => {
      const messageWithHost = getErrorMessage(ErrorCodes.WORKSPACE_NOT_FOUND, { host: "example.com" })
      expect(messageWithHost).toContain("example.com")

      const messageWithField = getErrorMessage(ErrorCodes.INVALID_REQUEST, { field: "email" })
      expect(messageWithField).toContain("email")
    })

    it("should handle missing details gracefully", () => {
      expect(() => getErrorMessage(ErrorCodes.WORKSPACE_NOT_FOUND)).not.toThrow()
      expect(() => getErrorMessage(ErrorCodes.INVALID_REQUEST)).not.toThrow()
    })

    it("should return fallback for unknown error codes", () => {
      // @ts-expect-error — intentionally passing an invalid error code to test fallback behavior
      const message = getErrorMessage("UNKNOWN_CODE_XYZ")
      expect(message).toMatch(/something went wrong/i)
    })
  })

  describe("getErrorHelp", () => {
    it("should return null — error messages are self-contained", () => {
      const criticalErrors = [
        ErrorCodes.WORKSPACE_NOT_FOUND,
        ErrorCodes.PATH_OUTSIDE_WORKSPACE,
        ErrorCodes.ERROR_MAX_TURNS,
        ErrorCodes.TOOL_NOT_ALLOWED,
        ErrorCodes.FILE_READ_ERROR,
        ErrorCodes.CONVERSATION_BUSY,
        ErrorCodes.INVALID_CREDENTIALS,
      ]

      for (const code of criticalErrors) {
        expect(getErrorHelp(code)).toBeNull()
      }
    })
  })

  describe("isWorkspaceError", () => {
    it("should identify workspace-related errors", () => {
      expect(isWorkspaceError(ErrorCodes.WORKSPACE_NOT_FOUND)).toBe(true)
      expect(isWorkspaceError(ErrorCodes.WORKSPACE_INVALID)).toBe(true)
      expect(isWorkspaceError(ErrorCodes.WORKSPACE_MISSING)).toBe(true)
      expect(isWorkspaceError(ErrorCodes.WORKSPACE_RESTART_FAILED)).toBe(true)
    })

    it("should not identify non-workspace errors", () => {
      expect(isWorkspaceError(ErrorCodes.INVALID_CREDENTIALS)).toBe(false)
      expect(isWorkspaceError(ErrorCodes.FILE_READ_ERROR)).toBe(false)
      expect(isWorkspaceError(ErrorCodes.CONVERSATION_BUSY)).toBe(false)
    })
  })

  describe("Error Code Consistency", () => {
    it("should have unique error codes", () => {
      const codes = Object.values(ErrorCodes)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })

    it("should use SCREAMING_SNAKE_CASE for all codes", () => {
      const codes = Object.values(ErrorCodes)
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z_]+$/)
      }
    })

    it("should group errors logically by prefix", () => {
      expect(ErrorCodes.WORKSPACE_NOT_FOUND).toMatch(/^WORKSPACE_/)
      expect(ErrorCodes.WORKSPACE_INVALID).toMatch(/^WORKSPACE_/)
      expect(ErrorCodes.FILE_READ_ERROR).toMatch(/^FILE_/)
      expect(ErrorCodes.FILE_WRITE_ERROR).toMatch(/^FILE_/)
      expect(ErrorCodes.IMAGE_UPLOAD_FAILED).toMatch(/^IMAGE_/)
      expect(ErrorCodes.IMAGE_DELETE_FAILED).toMatch(/^IMAGE_/)
    })
  })

  describe("Security-Critical Errors", () => {
    it("should have clear messages for security errors", () => {
      const securityErrors = [
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.INVALID_CREDENTIALS,
        ErrorCodes.PATH_OUTSIDE_WORKSPACE,
        ErrorCodes.TOOL_NOT_ALLOWED,
      ]

      for (const code of securityErrors) {
        const message = getErrorMessage(code)
        expect(message).toBeTruthy()
        expect(message).not.toMatch(/password|token|key|secret/i)
      }
    })

    it("should explain security boundaries clearly", () => {
      const message = getErrorMessage(ErrorCodes.PATH_OUTSIDE_WORKSPACE)
      expect(message).toMatch(/outside|workspace|allowed/i)

      const toolMessage = getErrorMessage(ErrorCodes.TOOL_NOT_ALLOWED)
      expect(toolMessage).toMatch(/not allowed/i)
    })
  })
})
