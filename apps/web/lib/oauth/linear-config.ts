/**
 * Linear OAuth Configuration Utilities
 *
 * Centralized configuration validation for Linear OAuth integration
 * to ensure DRY principle and consistent error handling.
 */

const LINEAR_CLIENT_ID = process.env.LINEAR_CLIENT_ID
const LINEAR_CLIENT_SECRET = process.env.LINEAR_CLIENT_SECRET
const LINEAR_REDIRECT_URI = process.env.LINEAR_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linear`

/**
 * Validates that Linear OAuth environment variables are properly configured.
 *
 * @throws {Error} if LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, or LINEAR_REDIRECT_URI is missing/invalid
 * @returns {Object} Validated OAuth configuration
 */
export function validateLinearConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  if (!LINEAR_CLIENT_ID || !LINEAR_CLIENT_SECRET) {
    throw new Error("Linear OAuth not configured. Set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET.")
  }

  if (!LINEAR_REDIRECT_URI || LINEAR_REDIRECT_URI.includes("undefined")) {
    throw new Error("Linear OAuth redirect URI not configured. Set LINEAR_REDIRECT_URI or NEXT_PUBLIC_APP_URL.")
  }

  return {
    clientId: LINEAR_CLIENT_ID,
    clientSecret: LINEAR_CLIENT_SECRET,
    redirectUri: LINEAR_REDIRECT_URI,
  }
}

/**
 * Gets Linear OAuth configuration with proper validation.
 * Returns null if not configured instead of throwing.
 *
 * Useful for non-critical paths where OAuth might be optional.
 */
export function getLinearConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} | null {
  try {
    return validateLinearConfig()
  } catch {
    return null
  }
}

/**
 * OAuth provider identifier for Linear
 */
export const LINEAR_PROVIDER = "linear" as const

/**
 * OAuth state cookie name for CSRF protection
 */
export const LINEAR_OAUTH_STATE_COOKIE = "oauth_state_linear" as const
