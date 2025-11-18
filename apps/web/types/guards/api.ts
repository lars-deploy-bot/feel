import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import bcrypt from "bcrypt"
import { z } from "zod"
import type { DomainPasswords } from "@/types/domain"

/**
 * API request validation and schema guards
 */

/**
 * Validate API key format
 * Valid Anthropic keys start with "sk-ant-" and are reasonably long
 */
function isValidApiKeyFormat(key: string): boolean {
  if (!key) return false
  // Must start with sk-ant- prefix
  if (!key.startsWith("sk-ant-")) return false
  // Must be at least sk-ant-X (7 + 1 = 8 chars)
  if (key.length < 20) return false
  // Must not contain spaces or newlines
  if (/\s/.test(key)) return false
  return true
}

/**
 * Zod schema for Claude API request body
 * IMPORTANT: All fields used by backend must be defined here
 */
export const BodySchema = z.object({
  message: z.string().min(1),
  workspace: z.string().optional(),
  conversationId: z.string().uuid(),
  apiKey: z
    .string()
    .refine(
      key => !key || isValidApiKeyFormat(key),
      "Invalid API key format. Must start with 'sk-ant-' and be at least 20 characters.",
    )
    .optional(),
  model: z.string().optional(),
  // Optional fields for system prompt context
  projectId: z.string().optional(),
  userId: z.string().optional(),
  additionalContext: z.string().optional(),
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

/**
 * @deprecated Since 2025-11-16 - Migrated to Supabase (iam.users table)
 * Use `updateDomainOwnerPassword()` from @/lib/auth/supabase-passwords instead
 * This function reads from legacy domain-passwords.json file
 */
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

/**
 * @deprecated Since 2025-11-16 - Migrated to Supabase (iam.users table)
 * Use `updateDomainOwnerPassword()` from @/lib/auth/supabase-passwords instead
 * This function writes to legacy domain-passwords.json file
 */
export function saveDomainPasswords(passwords: DomainPasswords): void {
  try {
    const filePath = getDomainPasswordsPath()
    writeFileSync(filePath, JSON.stringify(passwords, null, 2))
  } catch (error) {
    console.error("Failed to save domain passwords file:", error)
  }
}

/**
 * @deprecated Since 2025-11-16 - Migrated to Supabase (iam.users table)
 * Use domain → org_id lookup + user password verification via Supabase instead
 * This function reads from legacy domain-passwords.json file
 */
export async function isDomainPasswordValid(domain: string, providedPassword: string): Promise<boolean> {
  const passwords = loadDomainPasswords()
  const domainConfig = passwords[domain]

  if (!domainConfig?.passwordHash) {
    return false
  }

  return verifyPassword(providedPassword, domainConfig.passwordHash)
}

/**
 * @deprecated Since 2025-11-16 - Migrated to Supabase
 * - Password updates: Use `updateDomainOwnerPassword()` from @/lib/auth/supabase-passwords
 * - Email updates: Use `updateUserEmail()` from @/lib/auth/supabase-passwords
 * - Credits updates: Use `updateOrgCredits()` from @/lib/tokens
 * This function writes to legacy domain-passwords.json file
 */
export async function updateDomainConfig(
  domain: string,
  updates: { password?: string; email?: string; credits?: number },
): Promise<void> {
  const passwords = loadDomainPasswords()
  if (!passwords[domain]) return

  if (updates.password) {
    passwords[domain].passwordHash = await hashPassword(updates.password)
  }

  if (updates.email !== undefined) {
    passwords[domain].email = updates.email
  }

  if (updates.credits !== undefined && updates.credits >= 0) {
    passwords[domain].credits = updates.credits
  }

  saveDomainPasswords(passwords)
}
