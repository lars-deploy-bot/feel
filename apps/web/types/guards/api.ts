import { z } from "zod"

/**
 * API request validation and schema guards
 */

/**
 * Zod schema for Claude API request body
 */
export const BodySchema = z.object({
  message: z.string().min(1),
  workspace: z.string().optional(),
  conversationId: z.string().uuid(),
})

export type ValidatedBody = z.infer<typeof BodySchema>

/**
 * Zod schema for login request
 */
export const LoginSchema = z.object({
  passcode: z.string().optional(),
})

export type LoginRequest = z.infer<typeof LoginSchema>

/**
 * Check if a request body is valid (uses Zod safeParse)
 */
export function isValidRequestBody(body: unknown): body is ValidatedBody {
  const result = BodySchema.safeParse(body)
  return result.success
}

/**
 * Check if a login request is valid
 */
export function isValidLoginRequest(body: unknown): body is LoginRequest {
  const result = LoginSchema.safeParse(body)
  return result.success
}

/**
 * Validate request body and return parsed result with error details
 */
export function validateRequestBody(body: unknown) {
  return BodySchema.safeParse(body)
}

/**
 * Validate login request and return parsed result
 */
export function validateLoginRequest(body: unknown) {
  return LoginSchema.safeParse(body)
}

/**
 * Check if request body parsed successfully
 */
export function isParseResultSuccess<T>(
  result: z.ZodSafeParseResult<T>,
): result is z.ZodSafeParseSuccess<T> {
  return result.success
}

/**
 * Check if request body parsing failed
 */
export function isParseResultError<T>(result: z.ZodSafeParseResult<T>): result is z.ZodSafeParseError<T> {
  return !result.success
}

/**
 * Check if a tool name is in the allowed whitelist
 */
export function isToolAllowed(toolName: string, allowedTools: Set<string>): boolean {
  return allowedTools.has(toolName)
}

/**
 * Check if a passcode matches the required passcode
 * Returns true if no passcode is required or if passcode matches
 */
export function isPasscodeValid(provided: string | undefined, required: string | undefined): boolean {
  if (!required) {
    // No passcode required
    return true
  }
  // Passcode required and must match
  return provided === required
}

/**
 * Check if a JSON string is valid
 */
export function isValidJSON(jsonString: string): boolean {
  try {
    JSON.parse(jsonString)
    return true
  } catch {
    return false
  }
}
