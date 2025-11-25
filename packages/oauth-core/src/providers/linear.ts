/**
 * Linear OAuth Provider
 *
 * Implements OAuth 2.0 flow for Linear
 * Docs: https://developers.linear.app/docs/oauth/authentication
 */

import type { OAuthProvider } from "./base"
import type { OAuthTokens, GraphQLError } from "../types"

export const LINEAR_SCOPES = ["read", "write", "issues:create"] as const

export class LinearProvider implements OAuthProvider {
  name = "linear"

  /**
   * Exchanges authorization code for Linear access token
   */
  async exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri?: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
    })

    if (redirectUri) {
      params.append("redirect_uri", redirectUri)
    }

    const res = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Linear OAuth failed: ${res.status} ${error}`)
    }

    const data = await res.json()

    if (data.error) {
      throw new Error(`Linear OAuth error: ${data.error_description || data.error}`)
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope,
      token_type: data.token_type || "Bearer",
    }
  }

  /**
   * Refreshes an expired Linear access token
   *
   * Linear supports token refresh (unlike GitHub OAuth Apps)
   */
  async refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    })

    const res = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Linear token refresh failed: ${res.status} ${error}`)
    }

    const data = await res.json()

    if (data.error) {
      throw new Error(`Linear refresh error: ${data.error_description || data.error}`)
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Reuse if not provided
      expires_in: data.expires_in,
      scope: data.scope,
      token_type: data.token_type || "Bearer",
    }
  }

  /**
   * Revokes a Linear access token
   */
  async revokeToken(token: string, clientId: string, clientSecret: string): Promise<void> {
    const params = new URLSearchParams({
      access_token: token,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const res = await fetch("https://api.linear.app/oauth/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Linear token revocation failed: ${res.status} ${error}`)
    }
  }

  /**
   * Generates Linear authorization URL
   *
   * @param clientId - Linear OAuth App Client ID
   * @param redirectUri - Callback URL (must match Linear app config)
   * @param scope - Comma-separated scopes (e.g., "read,write,issues:create")
   * @param state - Random state for CSRF protection
   * @returns Authorization URL to redirect user to
   */
  getAuthUrl(clientId: string, redirectUri: string, scope: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope, // Linear uses comma-separated scopes
    })

    if (state) {
      params.append("state", state)
    }

    return `https://linear.app/oauth/authorize?${params.toString()}`
  }

  /**
   * Gets the authenticated user's info from Linear
   * Useful for verifying the connection works
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string
    email: string
    name: string
  }> {
    const query = `
      query Me {
        viewer {
          id
          email
          name
        }
      }
    `

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Linear API failed: ${res.status} ${error}`)
    }

    const data = await res.json()

    if (data.errors) {
      const errorDetails =
        data.errors?.map((e: GraphQLError) => e?.message || "Unknown error").join(", ") || "Unknown error"
      throw new Error(`Linear GraphQL error: ${errorDetails}. This may indicate missing scopes or an invalid token.`)
    }

    return data.data.viewer
  }
}
