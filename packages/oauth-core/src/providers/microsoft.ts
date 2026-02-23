/**
 * Microsoft OAuth Provider
 *
 * Implements OAuth 2.0 flow for Microsoft Graph (Outlook, etc.)
 * Docs: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 *
 * Key differences from other providers:
 * - Uses Azure AD v2.0 endpoints (/common/ for multi-tenant)
 * - offline_access scope required for refresh tokens (not a separate param like Google)
 * - Supports PKCE for public clients
 * - Token refresh returns a new refresh_token (rotation)
 * - Supports token revocation via logout endpoint (not per-token)
 */

import { MICROSOFT_GRAPH_SCOPES } from "@webalive/shared"
import { fetchWithRetry } from "../fetch-with-retry"
import type { OAuthTokens } from "../types"
import type { OAuthProviderCore, OAuthRefreshable, PKCEOptions, TokenExchangeOptions } from "./base"

export class MicrosoftProvider implements OAuthProviderCore, OAuthRefreshable {
  name = "microsoft"

  // ---------------------------------------------------------------------------
  // Individual scope URIs — re-exported from @webalive/shared (single source of truth)
  // ---------------------------------------------------------------------------

  static readonly SCOPES = MICROSOFT_GRAPH_SCOPES

  // ---------------------------------------------------------------------------
  // Capability-level scope profiles
  // ---------------------------------------------------------------------------

  /**
   * Outlook read+send scopes: read mail, send mail, read profile.
   * offline_access is requested but NOT validated at callback
   * (Microsoft doesn't return it in the granted scope string).
   */
  static readonly OUTLOOK_READWRITE_SCOPES = [
    MicrosoftProvider.SCOPES.OFFLINE_ACCESS,
    MicrosoftProvider.SCOPES.MAIL_READWRITE,
    MicrosoftProvider.SCOPES.MAIL_SEND,
    MicrosoftProvider.SCOPES.USER_READ,
  ].join(" ")

  /**
   * Outlook read-only scopes (safer for initial testing)
   */
  static readonly OUTLOOK_READONLY_SCOPES = [
    MicrosoftProvider.SCOPES.OFFLINE_ACCESS,
    MicrosoftProvider.SCOPES.MAIL_READ,
    MicrosoftProvider.SCOPES.USER_READ,
  ].join(" ")

  /**
   * Exchanges authorization code for Microsoft access + refresh tokens
   *
   * Supports PKCE for public clients (no client_secret required)
   */
  async exchangeCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri?: string,
    options?: TokenExchangeOptions,
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: "authorization_code",
    })

    // PKCE flow: use code_verifier instead of client_secret
    if (options?.code_verifier) {
      params.append("code_verifier", options.code_verifier)
    }

    // Add client_secret only if provided (confidential clients)
    if (clientSecret) {
      params.append("client_secret", clientSecret)
    }

    if (redirectUri) {
      params.append("redirect_uri", redirectUri)
    }

    // Additional body params (from n8n pattern)
    if (options?.additionalBodyParams) {
      for (const [key, value] of Object.entries(options.additionalBodyParams)) {
        params.append(key, value)
      }
    }

    const res = await fetchWithRetry(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
      { label: "Microsoft" },
    )

    let data: Record<string, unknown>
    try {
      data = await res.json()
    } catch {
      throw new Error(`Microsoft OAuth failed: ${res.status} ${res.statusText} (non-JSON response)`)
    }

    if (!res.ok || data.error) {
      console.error("[Microsoft OAuth] Token exchange failed:", {
        status: res.status,
        statusText: res.statusText,
        error: data.error,
        errorDescription: data.error_description,
        redirectUriUsed: redirectUri || "(not provided)",
        hint:
          data.error === "invalid_grant" || res.status === 400
            ? "This usually means redirect_uri mismatch or expired code. Check Azure AD app registration."
            : undefined,
      })
      throw new Error(`Microsoft OAuth failed: ${String(data.error_description || data.error || res.statusText)}`)
    }

    return {
      access_token: data.access_token as string,
      refresh_token: data.refresh_token as string | undefined,
      expires_in: data.expires_in as number | undefined,
      scope: data.scope as string | undefined,
      token_type: (data.token_type as string) || "Bearer",
    }
  }

  /**
   * Refreshes an expired access token using the refresh token
   *
   * Microsoft returns a NEW refresh_token on every refresh (rotation).
   * The old refresh_token is invalidated.
   */
  async refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    })

    // Add client_secret for confidential clients
    if (clientSecret) {
      params.append("client_secret", clientSecret)
    }

    const res = await fetchWithRetry(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
      { label: "Microsoft" },
    )

    let data: Record<string, unknown>
    try {
      data = await res.json()
    } catch {
      throw new Error(`Microsoft token refresh failed: ${res.status} ${res.statusText} (non-JSON response)`)
    }

    if (!res.ok || data.error) {
      const errorMsg = String(data.error_description || data.error || res.statusText)
      if (data.error === "invalid_grant") {
        throw new Error(
          `Microsoft token refresh failed: ${errorMsg}. The refresh token may have been revoked or expired. User must re-authenticate.`,
        )
      }
      throw new Error(`Microsoft token refresh failed: ${errorMsg}`)
    }

    return {
      access_token: data.access_token as string,
      // Microsoft returns a new refresh_token on refresh (token rotation)
      refresh_token: data.refresh_token as string | undefined,
      expires_in: data.expires_in as number | undefined,
      scope: data.scope as string | undefined,
      token_type: (data.token_type as string) || "Bearer",
    }
  }

  /**
   * Generates Microsoft authorization URL
   *
   * @param clientId - Azure AD Application (client) ID
   * @param redirectUri - Callback URL (must match Azure AD app registration)
   * @param scope - Space-separated scopes (e.g., "offline_access Mail.Read User.Read")
   * @param state - Random state for CSRF protection
   * @param pkce - PKCE challenge for public clients (optional)
   * @returns Authorization URL to redirect user to
   *
   * @example
   * const url = provider.getAuthUrl(
   *   clientId,
   *   'https://example.com/callback',
   *   MicrosoftProvider.OUTLOOK_READWRITE_SCOPES,
   *   crypto.randomUUID()
   * )
   */
  getAuthUrl(clientId: string, redirectUri: string, scope: string, state?: string, pkce?: PKCEOptions): string {
    // Always include offline_access to get refresh tokens.
    // Microsoft doesn't return offline_access in the granted scope string,
    // so defaultScopes (used for validation) excludes it. We inject it here.
    const scopeSet = new Set(scope.split(/\s+/).filter(Boolean))
    scopeSet.add("offline_access")
    const fullScope = [...scopeSet].join(" ")

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: fullScope,
    })

    if (state) {
      params.append("state", state)
    }

    // PKCE support for public clients
    if (pkce) {
      params.append("code_challenge", pkce.code_challenge)
      params.append("code_challenge_method", pkce.code_challenge_method)
    }

    // Force consent to always get refresh token on re-auth
    params.append("prompt", "consent")

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  }

  /**
   * Gets basic user info from Microsoft Graph
   * Useful for getting email after OAuth flow
   *
   * @param accessToken - Valid access token
   * @returns User info (email, displayName, etc.)
   */
  async getUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
    const res = await fetchWithRetry(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      { label: "Microsoft" },
    )

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Failed to get Microsoft user info: ${res.status} ${error || res.statusText}`)
    }

    return res.json()
  }
}

/**
 * Microsoft user info response from /me endpoint
 */
export interface MicrosoftUserInfo {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  givenName?: string
  surname?: string
  jobTitle?: string
}
