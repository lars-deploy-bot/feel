import { REFERRAL } from "@webalive/shared"

// Re-export from @webalive/org — single source of truth
export { buildInviteLink } from "@webalive/org"

const STORAGE_KEY = "alive_referral"

/**
 * Get stored referral code from localStorage (with expiry check)
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const { code, expires } = JSON.parse(stored)
    if (Date.now() > expires) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return code
  } catch {
    // localStorage may throw in private browsing - fail silently
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore cleanup errors
    }
    return null
  }
}

/**
 * Store referral code in localStorage with expiry
 */
export function storeReferralCode(code: string): void {
  if (typeof window === "undefined") return

  try {
    const expires = Date.now() + REFERRAL.EXPIRY_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, expires }))
  } catch {
    // localStorage may throw in private browsing - fail silently
  }
}

/**
 * Clear stored referral code
 */
export function clearStoredReferralCode(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage may throw in private browsing - fail silently
  }
}
