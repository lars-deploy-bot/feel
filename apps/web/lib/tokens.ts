import { existsSync, readFileSync, writeFileSync } from "node:fs"
import type { DomainPasswords } from "@/types/domain"
import { llmTokensToCredits } from "./credits"

/**
 * Credits Service - Workspace Credit Balance Management
 *
 * ARCHITECTURE:
 * - Credits are the primary currency stored in domain-passwords.json
 * - Conversion to LLM tokens happens ONLY when charging (1-3 lines in one function)
 * - Example: User has 200 credits, gets charged 5 credits, ends with 195 credits
 *
 * TERMINOLOGY:
 * - CREDITS: Our currency (stored in DB, shown to users)
 * - LLM TOKENS: What Claude API returns (input_tokens, output_tokens)
 * - Conversion: 1 credit = 100 LLM tokens (used only at charge time)
 *
 * All operations are atomic and safe for concurrent access.
 */

/**
 * Workspace credit discount multiplier (0.0 to 1.0)
 * Determines what percentage of actual LLM tokens users are charged in credits
 */
export const WORKSPACE_CREDIT_DISCOUNT = 0.25

/**
 * Source of API key being used for request
 * - workspace: Using workspace credits (our currency)
 * - user_provided: Using user's own Claude API key (not charged)
 */
export type TokenSource = "workspace" | "user_provided"

/**
 * LLM Token Usage data from Claude API response
 * These are the actual tokens consumed by the Claude API
 */
export interface LLMTokenUsage {
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
  const devPaths = [`${process.cwd()}/domain-passwords.json`, "/root/webalive/claude-bridge/domain-passwords.json"]

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
 * Get current credit balance for a workspace
 *
 * @param workspace - Domain/workspace identifier
 * @returns Current credit balance, or null if workspace not found
 */
export function getWorkspaceCredits(workspace: string): number | null {
  const passwords = loadDomainPasswords()
  const config = passwords[workspace]

  if (!config) {
    return null
  }

  return config.credits ?? 0
}

/**
 * Calculate LLM token cost from Claude API usage object
 *
 * Returns total LLM tokens consumed.
 * Cost = input_tokens + output_tokens
 * (Cache tokens are not counted as they're usually cheaper/free)
 *
 * @param usage - LLM usage object from Claude API response
 * @returns Total LLM tokens consumed
 */
export function calculateLLMTokenCost(usage: LLMTokenUsage): number {
  return usage.input_tokens + usage.output_tokens
}

/**
 * Check if workspace has enough credits for a request
 *
 * @param workspace - Domain/workspace identifier
 * @param requiredCredits - Number of credits required
 * @returns true if enough credits, false otherwise
 */
export function hasEnoughCredits(workspace: string, requiredCredits: number): boolean {
  const current = getWorkspaceCredits(workspace)

  if (current === null) {
    return false
  }

  return current >= requiredCredits
}

/**
 * Charge credits to workspace balance based on LLM tokens used
 *
 * This is the ONLY place where LLM tokens are converted to credits (1-3 lines).
 * All other operations work with credits directly.
 *
 * @param workspace - Domain/workspace identifier
 * @param llmTokensUsed - Number of LLM tokens actually used by Claude API
 * @returns New credit balance, or null if operation failed
 */
export function chargeTokensFromCredits(workspace: string, llmTokensUsed: number): number | null {
  if (llmTokensUsed < 0) {
    console.error("[Credits] Cannot charge negative amount:", llmTokensUsed)
    return null
  }

  const passwords = loadDomainPasswords()
  const config = passwords[workspace]

  if (!config) {
    console.error("[Credits] Workspace not found:", workspace)
    return null
  }

  // CONVERSION STEP: Convert LLM tokens to credits and apply discount (1-3 lines as requested)
  const creditsUsed = llmTokensToCredits(llmTokensUsed)
  const chargedCredits = Math.floor(creditsUsed * WORKSPACE_CREDIT_DISCOUNT * 100) / 100

  const currentBalance = config.credits ?? 0
  const newBalance = Math.round((currentBalance - chargedCredits) * 100) / 100

  if (newBalance < 0) {
    console.error("[Credits] Insufficient balance:", {
      workspace,
      current: currentBalance,
      requested: chargedCredits,
      actualTokensUsed: llmTokensUsed,
    })
    return null
  }

  // Update balance
  passwords[workspace].credits = newBalance

  // Save to disk (atomic)
  saveDomainPasswords(passwords)

  console.log("[Credits] Charged credits:", {
    workspace,
    actualTokensUsed: llmTokensUsed,
    creditsUsed,
    chargedCredits,
    discountSaved: creditsUsed - chargedCredits,
    oldBalance: currentBalance,
    newBalance,
  })

  return newBalance
}

/**
 * Verify workspace has credits available for API call
 *
 * @param workspace - Domain/workspace identifier
 * @throws Error if workspace not found or insufficient balance
 */
export function ensureSufficientCredits(workspace: string): void {
  const balance = getWorkspaceCredits(workspace)

  if (balance === null) {
    throw new Error("Workspace not found")
  }

  if (balance <= 0) {
    throw new Error(`Insufficient credits (balance: ${balance}, needs: >= 1)`)
  }
}

/**
 * Add credits to workspace balance (admin refill)
 *
 * @param workspace - Domain/workspace identifier
 * @param creditsToAdd - Number of credits to add
 * @returns New credit balance, or null if operation failed
 */
export function addCredits(workspace: string, creditsToAdd: number): number | null {
  if (creditsToAdd < 0) {
    console.error("[Credits] Cannot add negative amount:", creditsToAdd)
    return null
  }

  const passwords = loadDomainPasswords()
  const config = passwords[workspace]

  if (!config) {
    console.error("[Credits] Workspace not found:", workspace)
    return null
  }

  const currentBalance = config.credits ?? 0
  const newBalance = Math.round((currentBalance + creditsToAdd) * 100) / 100

  // Update balance
  passwords[workspace].credits = newBalance

  // Save to disk
  saveDomainPasswords(passwords)

  console.log("[Credits] Added credits:", {
    workspace,
    creditsToAdd,
    oldBalance: currentBalance,
    newBalance,
  })

  return newBalance
}
