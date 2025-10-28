import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
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
  workspace: z.string().optional(),
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
export function isParseResultSuccess<T>(result: z.ZodSafeParseResult<T>): result is z.ZodSafeParseSuccess<T> {
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

/**
 * Domain password management
 */
interface DomainConfig {
  password: string
  port: number
}

type DomainPasswords = Record<string, DomainConfig>

function getDomainPasswordsPath(): string {
  // Check multiple possible locations for the domain-passwords.json file
  const possiblePaths = [
    join(process.cwd(), "..", "..", "domain-passwords.json"),
    join(process.cwd(), "domain-passwords.json"),
    "/root/webalive/claude-bridge/domain-passwords.json",
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log("Found domain passwords at:", path)
      return path
    }
  }

  console.log("Domain passwords file not found, checked:", possiblePaths)
  return possiblePaths[0] // Return default path for creation
}

export function loadDomainPasswords(): DomainPasswords {
  try {
    const filePath = getDomainPasswordsPath()
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf8"))
    }
  } catch (error) {
    console.warn("Failed to read domain passwords file:", error)
  }
  return {}
}

export function saveDomainPasswords(passwords: DomainPasswords): void {
  try {
    const filePath = getDomainPasswordsPath()
    writeFileSync(filePath, JSON.stringify(passwords, null, 2))
  } catch (error) {
    console.error("Failed to save domain passwords file:", error)
  }
}

export function getDomainPassword(domain: string): string | null {
  const passwords = loadDomainPasswords()
  return passwords[domain]?.password || null
}

export function isDomainPasswordValid(domain: string, providedPassword: string): boolean {
  const requiredPassword = getDomainPassword(domain)
  if (!requiredPassword) {
    return false
  }
  return providedPassword === requiredPassword
}

export function updateDomainPassword(domain: string, newPassword: string): void {
  const passwords = loadDomainPasswords()
  if (passwords[domain]) {
    passwords[domain].password = newPassword
    saveDomainPasswords(passwords)
  }
}

export function deleteDomainPassword(domain: string): void {
  const passwords = loadDomainPasswords()
  if (passwords[domain]) {
    delete passwords[domain]
    saveDomainPasswords(passwords)
  }
}
