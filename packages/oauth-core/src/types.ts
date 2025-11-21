/**
 * OAuth Core Type Definitions
 */

export type SecretNamespace = 'provider_config' | 'oauth_tokens';

export interface EncryptedPayload {
  ciphertext: string; // Postgres bytea format: "\x..."
  iv: string; // 12 bytes in hex
  authTag: string; // 16 bytes in hex
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface ProviderConfig {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
}

export interface UserSecret {
  secret_id: string;
  clerk_id: string;
  namespace: SecretNamespace;
  name: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}
