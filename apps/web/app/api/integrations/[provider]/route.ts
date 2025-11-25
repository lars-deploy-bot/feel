/**
 * Integration Management API
 *
 * Clean implementation with DRY principle.
 * Handles connection status checks and disconnection for OAuth providers.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse, getSessionUser } from "@/features/auth/lib/auth"
import { getClientIdentifier } from "@/lib/auth/client-identifier"
import { oauthOperationRateLimiter } from "@/lib/auth/rate-limiter"
import { ErrorCodes } from "@/lib/error-codes"
import { validateProviderName } from "@/lib/integrations/validation"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"

/**
 * Common request validation and rate limiting
 *
 * DRY: Shared validation logic for both GET and DELETE endpoints
 */
async function validateIntegrationRequest(
  req: NextRequest,
  params: Promise<{ provider: string }>,
): Promise<{ ok: true; provider: string; user: { id: string } } | { ok: false; response: NextResponse }> {
  // 1. Validate provider
  const resolved = await params
  const validation = validateProviderName(resolved.provider)

  if (!validation.valid) {
    console.error("[Integration] Invalid provider:", {
      attempted: resolved.provider,
      reason: validation.error,
    })
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.INVALID_PROVIDER, 400, {
        reason: validation.error,
      }),
    }
  }

  const provider = validation.provider!

  // 2. Authenticate user
  const user = await getSessionUser()
  if (!user) {
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.UNAUTHORIZED, 401),
    }
  }

  // 3. Check rate limit
  const clientId = getClientIdentifier(req, `integration:${provider}`)
  if (oauthOperationRateLimiter.isRateLimited(clientId)) {
    const blockedTime = oauthOperationRateLimiter.getBlockedTimeRemaining(clientId)
    const minutesRemaining = Math.ceil(blockedTime / 1000 / 60)

    console.warn(`[${provider} Integration] Rate limited:`, clientId)

    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.TOO_MANY_REQUESTS, 429, {
        retryAfter: `${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}`,
      }),
    }
  }

  return { ok: true, provider, user }
}

/**
 * GET /api/integrations/[provider]
 *
 * Check if user is connected to a provider.
 *
 * Response:
 * - 200: { connected: boolean, provider: string }
 * - 400: Invalid provider
 * - 401: Unauthorized
 * - 429: Rate limited
 * - 500: Internal error
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  // Common validation
  const validation = await validateIntegrationRequest(req, params)
  if (!validation.ok) {
    return validation.response
  }

  const { provider, user } = validation

  try {
    // Check connection status
    const oauthManager = getOAuthInstance(provider)
    const isConnected = await oauthManager.isConnected(user.id, provider)

    console.log(`[${provider} Integration] Status check - connected: ${isConnected}`)

    return NextResponse.json({
      connected: isConnected,
      provider,
    })
  } catch (error) {
    console.error(`[${provider} Integration] Status check failed:`, error)

    // Security: Don't expose internal error details
    return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, 500, {
      provider,
    })
  }
}

/**
 * DELETE /api/integrations/[provider]
 *
 * Disconnect user from a provider.
 * Attempts graceful revocation with provider, falls back to local disconnect.
 *
 * Response:
 * - 200: { ok: true, message: string }
 * - 400: Not connected or invalid provider
 * - 401: Unauthorized
 * - 429: Rate limited
 * - 500: Internal error
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  // Common validation
  const validation = await validateIntegrationRequest(req, params)
  if (!validation.ok) {
    return validation.response
  }

  const { provider, user } = validation
  const clientId = getClientIdentifier(req, `integration:${provider}`)

  try {
    const oauthManager = getOAuthInstance(provider)

    // Verify user is connected
    const isConnected = await oauthManager.isConnected(user.id, provider)
    if (!isConnected) {
      // Record invalid attempt
      oauthOperationRateLimiter.recordFailedAttempt(clientId)

      return createErrorResponse(ErrorCodes.INTEGRATION_NOT_CONNECTED, 400, {
        provider,
      })
    }

    // Attempt graceful revocation
    await revokeTokenGracefully(oauthManager, user.id, provider)

    // Success - reset rate limit
    oauthOperationRateLimiter.reset(clientId)

    console.log(`[${provider} Integration] Successfully disconnected user:`, user.id)

    return NextResponse.json({
      ok: true,
      message: `Disconnected from ${provider}`,
    })
  } catch (error) {
    console.error(`[${provider} Integration] Disconnect failed:`, error)

    // Security: Don't expose internal error details
    return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, 500, {
      provider,
    })
  }
}

/**
 * Attempt to revoke token with provider, fall back to local disconnect
 *
 * Graceful handling: If provider API is down or revocation fails,
 * we still disconnect locally to ensure user can disconnect.
 */
async function revokeTokenGracefully(
  oauthManager: ReturnType<typeof getOAuthInstance>,
  userId: string,
  provider: string,
): Promise<void> {
  try {
    // Try to revoke with provider
    await oauthManager.revoke(
      userId, // instanceId
      userId, // authenticatingUserId
      provider,
    )
    console.log(`[${provider} Integration] Token revoked with provider`)
  } catch (error) {
    // Provider might be down, still disconnect locally
    console.warn(`[${provider} Integration] Token revocation failed, disconnecting locally:`, error)
    await oauthManager.disconnect(userId, provider)
  }
}
