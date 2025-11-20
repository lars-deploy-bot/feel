import { existsSync, readFileSync } from "node:fs"
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
 * Load domain registry from domain-passwords.json
 *
 * Currently used for port assignment lookups. Legacy fields (passwordHash, email, credits)
 * are no longer written but may exist in old entries. All user data is now in Supabase.
 *
 * @returns Domain registry object (domain → {port, ...legacy fields})
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
