import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import bcrypt from "bcrypt"
import { z } from "zod"
import type { DomainPasswords } from "@/types/domain"

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
  apiKey: z.string().optional(),
  model: z.string().optional(),
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
export function isParseResultSuccess<T>(result: z.SafeParseReturnType<T, T>): result is z.SafeParseSuccess<T> {
  return result.success
}

/**
 * Check if request body parsing failed
 */
export function isParseResultError<T>(result: z.SafeParseReturnType<T, T>): result is z.SafeParseError<T> {
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

const SALT_ROUNDS = 12

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS)
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}

function getDomainPasswordsPath(): string {
  // PRODUCTION: Use persistent location outside of git and build process
  // This ensures the file survives deployments and doesn't require rebuilds
  const persistentPath = "/var/lib/claude-bridge/domain-passwords.json"

  // Always prefer persistent location if it exists
  if (existsSync(persistentPath)) {
    return persistentPath
  }

  // Fallback paths for development/testing
  const devPaths = [join(process.cwd(), "domain-passwords.json"), "/root/webalive/claude-bridge/domain-passwords.json"]

  for (const path of devPaths) {
    if (existsSync(path)) {
      console.log("Found domain passwords at:", path)
      return path
    }
  }

  console.log("Domain passwords file not found, using persistent path:", persistentPath)
  return persistentPath // Return persistent path for creation
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

export async function isDomainPasswordValid(domain: string, providedPassword: string): Promise<boolean> {
  const passwords = loadDomainPasswords()
  const domainConfig = passwords[domain]

  if (!domainConfig?.passwordHash) {
    return false
  }

  return verifyPassword(providedPassword, domainConfig.passwordHash)
}

export async function updateDomainConfig(
  domain: string,
  updates: { password?: string; email?: string }
): Promise<void> {
  const passwords = loadDomainPasswords()
  if (!passwords[domain]) return

  if (updates.password) {
    passwords[domain].passwordHash = await hashPassword(updates.password)
  }

  if (updates.email !== undefined) {
    passwords[domain].email = updates.email
  }

  saveDomainPasswords(passwords)
}

// Legacy exports for backwards compatibility
export const updateDomainPassword = (domain: string, password: string) =>
  updateDomainConfig(domain, { password })

export const updateDomainEmail = (domain: string, email: string) =>
  updateDomainConfig(domain, { email })
