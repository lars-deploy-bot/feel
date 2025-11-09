/**
 * Credit System
 *
 * Conversion ratio: 5000 API tokens = 1 credit
 *
 * User-facing: Credits (friendly, easy to understand)
 * Backend: Tokens (actual API usage tracking)
 */

export const TOKENS_PER_CREDIT = 5000

/**
 * Convert API tokens to credits
 * @param tokens - Number of API tokens
 * @returns Credits (rounded to 2 decimals)
 */
export function tokensToCredits(tokens: number): number {
  return Math.round((tokens / TOKENS_PER_CREDIT) * 100) / 100
}

/**
 * Convert credits to API tokens
 * @param credits - Number of credits
 * @returns API tokens
 */
export function creditsToTokens(credits: number): number {
  return Math.round(credits * TOKENS_PER_CREDIT)
}

/**
 * Format credits for display
 * @param credits - Number of credits
 * @returns Formatted string (e.g., "10.50")
 */
export function formatCredits(credits: number): string {
  return credits.toFixed(2)
}

/**
 * Check if user has enough credits for a token cost
 * @param availableTokens - Current token balance
 * @param requiredTokens - Tokens needed (will be deducted)
 * @returns true if sufficient balance
 */
export function hasSufficientCredits(availableTokens: number, requiredTokens: number = 1): boolean {
  return availableTokens >= requiredTokens
}

/**
 * Default starting balance
 * 50,000 tokens = 10 credits
 */
export const DEFAULT_STARTING_TOKENS = 50000
export const DEFAULT_STARTING_CREDITS = tokensToCredits(DEFAULT_STARTING_TOKENS)
