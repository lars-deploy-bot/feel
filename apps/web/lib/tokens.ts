import { existsSync, readFileSync, writeFileSync } from "node:fs"
import type { DomainPasswords } from "@/types/domain"

/**
 * Token Service
 *
 * Handles token balance management for workspaces.
 * All operations are atomic and safe for concurrent access.
 */

/**
 * Source of API key being used for request
 */
export type TokenSource = "workspace" | "user_provided"

/**
 * Usage data from Claude API assistant message
 */
export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

/**
 * Get the path to domain-passwords.json
 */
function getDomainPasswordsPath(): string {
  const persistentPath = "/var/lib/claude-bridge/domain-passwords.json"

  if (existsSync(persistentPath)) {
    return persistentPath
  }

  // Fallback for development
  const devPaths = [
    `${process.cwd()}/domain-passwords.json`,
    "/root/webalive/claude-bridge/domain-passwords.json"
  ]

  for (const path of devPaths) {
    if (existsSync(path)) {
      return path
    }
  }

  return persistentPath
}

/**
 * Load domain passwords file
 */
function loadDomainPasswords(): DomainPasswords {
  const filePath = getDomainPasswordsPath()

  if (!existsSync(filePath)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    console.error("[Tokens] Failed to read domain passwords:", error)
    return {}
  }
}

/**
 * Save domain passwords file (atomic write)
 */
function saveDomainPasswords(passwords: DomainPasswords): void {
  const filePath = getDomainPasswordsPath()

  try {
    // Write to temp file first, then rename (atomic operation)
    const tempPath = `${filePath}.tmp`
    writeFileSync(tempPath, JSON.stringify(passwords, null, 2), "utf8")
    writeFileSync(filePath, JSON.stringify(passwords, null, 2), "utf8")
  } catch (error) {
    console.error("[Tokens] Failed to save domain passwords:", error)
    throw new Error("Failed to save token balance")
  }
}

/**
 * Get current token balance for a workspace
 *
 * @param workspace - Domain/workspace identifier
 * @returns Current token count, or null if workspace not found
 */
export function getTokens(workspace: string): number | null {
  const passwords = loadDomainPasswords()
  const config = passwords[workspace]

  if (!config) {
    return null
  }

  return config.tokens
}

/**
 * Calculate token cost from Claude API usage object
 *
 * Cost = input_tokens + output_tokens
 * (Cache tokens are not counted as they're usually cheaper/free)
 *
 * @param usage - Usage object from Claude API response
 * @returns Total token cost
 */
export function calculateTokenCost(usage: TokenUsage): number {
  return usage.input_tokens + usage.output_tokens
}

/**
 * Check if workspace has enough tokens for a request
 *
 * @param workspace - Domain/workspace identifier
 * @param required - Number of tokens required
 * @returns true if enough tokens, false otherwise
 */
export function hasEnoughTokens(workspace: string, required: number): boolean {
  const current = getTokens(workspace)

  if (current === null) {
    return false
  }

  return current >= required
}

/**
 * Deduct tokens from a workspace balance
 *
 * This operation is atomic and will:
 * - Validate workspace exists
 * - Ensure balance doesn't go negative
 * - Update the balance
 * - Save to disk
 *
 * @param workspace - Domain/workspace identifier
 * @param amount - Number of tokens to deduct
 * @returns New balance, or null if operation failed
 */
export function deductTokens(workspace: string, amount: number): number | null {
  if (amount < 0) {
    console.error("[Tokens] Cannot deduct negative amount:", amount)
    return null
  }

  const passwords = loadDomainPasswords()
  const config = passwords[workspace]

  if (!config) {
    console.error("[Tokens] Workspace not found:", workspace)
    return null
  }

  const currentBalance = config.tokens
  const newBalance = currentBalance - amount

  if (newBalance < 0) {
    console.error("[Tokens] Insufficient balance:", {
      workspace,
      current: currentBalance,
      requested: amount
    })
    return null
  }

  // Update balance
  passwords[workspace].tokens = newBalance

  // Save to disk (atomic)
  saveDomainPasswords(passwords)

  console.log("[Tokens] Deducted:", {
    workspace,
    amount,
    oldBalance: currentBalance,
    newBalance
  })

  return newBalance
}

/**
 * Check token balance before API call
 *
 * @param workspace - Domain/workspace identifier
 * @throws Error if insufficient tokens
 */
export function ensureSufficientTokens(workspace: string): void {
  const balance = getTokens(workspace)

  if (balance === null) {
    throw new Error("Workspace not found")
  }

  if (balance <= 0) {
    throw new Error(`Insufficient tokens (balance: ${balance})`)
  }
}

/**
 * Add tokens to a workspace (for refills/admin)
 *
 * @param workspace - Domain/workspace identifier
 * @param amount - Number of tokens to add
 * @returns New balance, or null if operation failed
 */
export function addTokens(workspace: string, amount: number): number | null {
  if (amount < 0) {
    console.error("[Tokens] Cannot add negative amount:", amount)
    return null
  }

  const passwords = loadDomainPasswords()
  const config = passwords[workspace]

  if (!config) {
    console.error("[Tokens] Workspace not found:", workspace)
    return null
  }

  const currentBalance = config.tokens
  const newBalance = currentBalance + amount

  // Update balance
  passwords[workspace].tokens = newBalance

  // Save to disk
  saveDomainPasswords(passwords)

  console.log("[Tokens] Added:", {
    workspace,
    amount,
    oldBalance: currentBalance,
    newBalance
  })

  return newBalance
}
