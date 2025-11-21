/**
 * GitHub OAuth Provider
 *
 * Implements OAuth 2.0 flow for GitHub
 * Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
 */

import type { OAuthProvider } from './base.js';
import type { OAuthTokens } from '../types.js';

export class GitHubProvider implements OAuthProvider {
  name = 'github';

  /**
   * Exchanges authorization code for GitHub access token
   */
  async exchangeCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri?: string
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    if (redirectUri) {
      params.append('redirect_uri', redirectUri);
    }

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`GitHub OAuth failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    if (data.error) {
      throw new Error(
        `GitHub OAuth error: ${data.error_description || data.error}`
      );
    }

    return {
      access_token: data.access_token,
      scope: data.scope,
      token_type: data.token_type || 'bearer',
    };
  }

  /**
   * Revokes a GitHub access token
   *
   * Note: GitHub doesn't support token refresh for OAuth Apps (only GitHub Apps)
   */
  async revokeToken(
    token: string,
    clientId: string,
    clientSecret: string
  ): Promise<void> {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch(
      `https://api.github.com/applications/${clientId}/token`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({ access_token: token }),
      }
    );

    if (!res.ok && res.status !== 204) {
      const error = await res.text();
      throw new Error(`GitHub token revocation failed: ${res.status} ${error}`);
    }
  }

  /**
   * Generates GitHub authorization URL
   *
   * @param clientId - GitHub OAuth App Client ID
   * @param redirectUri - Callback URL (must match GitHub app config)
   * @param scope - Space-separated scopes (e.g., "repo user")
   * @param state - Random state for CSRF protection
   * @returns Authorization URL to redirect user to
   */
  getAuthUrl(
    clientId: string,
    redirectUri: string,
    scope: string,
    state?: string
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
    });

    if (state) {
      params.append('state', state);
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
}
