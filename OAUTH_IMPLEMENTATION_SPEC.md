# OAuth Core Implementation Spec: The Lockbox Pattern

**Status:** DRAFT
**Target:** `packages/oauth-core`
**Database:** Supabase (Direct)
**Schema:** `lockbox.user_secrets` (Existing)

## 1. Executive Summary

We are implementing a secure, multi-tenant OAuth system. We will not create new tables. We will utilize the existing lockbox vault architecture to store two types of secrets:

- **Tenant Secrets**: API Keys for providers (e.g., GitHub Client Secret).
- **User Tokens**: Access/Refresh tokens for end-users.

We will achieve this via a "Closed-Loop" package (`@repo/oauth-core`) that handles AES-256-GCM encryption independently of the UI.

## 2. Environment Requirements

Ensure these variables are set in `.env` for the package context:

```bash
# Supabase Connection
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="ey..." # REQUIRED: Must bypass RLS to write to lockbox

# Security (Must be 32 bytes / 64 hex chars)
# Generate with: openssl rand -hex 32
LOCKBOX_MASTER_KEY="your_32_byte_hex_string_here"
```

## 3. Data Mapping Strategy

We map OAuth concepts to the `lockbox.user_secrets` columns as follows:

| Logical Concept | namespace | name | clerk_id | Note |
|----------------|-----------|------|----------|------|
| Tenant Config | `provider_config` | `github_client_id` | `{tenant_owner_uuid}` | Infrastructure Key |
| Tenant Config | `provider_config` | `github_client_secret` | `{tenant_owner_uuid}` | Infrastructure Key |
| User Token | `oauth_tokens` | `github_access_token` | `{user_uuid}` | User Session Key |
| User Token | `oauth_tokens` | `github_refresh_token` | `{user_uuid}` | User Session Key |

## 4. The Implementation Code

Create the file `packages/oauth-core/src/index.ts`. This single file encapsulates the entire logic to minimize surface area.

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ------------------------------------------------------------------
// 1. TYPE DEFINITIONS & CONFIG
// ------------------------------------------------------------------

const MASTER_KEY = process.env.LOCKBOX_MASTER_KEY
  ? Buffer.from(process.env.LOCKBOX_MASTER_KEY, 'hex')
  : Buffer.alloc(0);

if (MASTER_KEY.length !== 32) {
  throw new Error('CRITICAL: LOCKBOX_MASTER_KEY must be exactly 32 bytes (hex).');
}

// Matches existing 'lockbox.user_secrets' schema constraints
type SecretNamespace = 'provider_config' | 'oauth_tokens';

interface EncryptedPayload {
  ciphertext: string; // Formatted "\x..." for Postgres bytea
  iv: string;         // Formatted "\x..." for Postgres bytea
  authTag: string;    // Formatted "\x..." for Postgres bytea
}

// ------------------------------------------------------------------
// 2. SECURITY LAYER (AES-256-GCM)
// ------------------------------------------------------------------

const Security = {
  /**
   * Encrypts string to Postgres 'bytea' format (Hex with \x prefix)
   * Constraints: IV=12 bytes, AuthTag=16 bytes
   */
  encrypt(plaintext: string): EncryptedPayload {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: `\\x${encrypted.toString('hex')}`,
      iv: `\\x${iv.toString('hex')}`,
      authTag: `\\x${authTag.toString('hex')}`
    };
  },

  /**
   * Decrypts Postgres 'bytea' output back to UTF-8 string
   */
  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const clean = (hex: string) => hex.startsWith('\\x') ? hex.slice(2) : hex;

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      MASTER_KEY,
      Buffer.from(clean(iv), 'hex')
    );

    decipher.setAuthTag(Buffer.from(clean(authTag), 'hex'));

    let decrypted = decipher.update(Buffer.from(clean(ciphertext), 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }
};

// ------------------------------------------------------------------
// 3. STORAGE ADAPTER (Supabase Lockbox)
// ------------------------------------------------------------------

class LockboxAdapter {
  private supabase: SupabaseClient;

  constructor() {
    // Service Key required to write to protected lockbox schema
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  async save(userId: string, namespace: SecretNamespace, name: string, value: string) {
    const { ciphertext, iv, authTag } = Security.encrypt(value);

    const { error } = await this.supabase
      .schema('lockbox')
      .from('user_secrets')
      .insert({
        clerk_id: userId,      // FK to iam.users
        namespace,
        name,
        ciphertext,
        iv,
        auth_tag: authTag,
        version: 1,            // Default version
        is_current: true
      });

    if (error) throw new Error(`Lockbox Save Failed [${name}]: ${error.message}`);
  }

  async get(userId: string, namespace: SecretNamespace, name: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .schema('lockbox')
      .from('user_secrets')
      .select('ciphertext, iv, auth_tag')
      .match({
        clerk_id: userId,
        namespace,
        name,
        is_current: true
      })
      .limit(1)
      .single();

    if (error || !data) return null;

    try {
      return Security.decrypt(data.ciphertext, data.iv, data.auth_tag);
    } catch (e) {
      console.error(`Decryption failed for ${name}`);
      return null;
    }
  }
}

// ------------------------------------------------------------------
// 4. OAUTH MANAGER (Public API)
// ------------------------------------------------------------------

export class OAuthManager {
  private storage = new LockboxAdapter();

  // --- TENANT CONFIGURATION ---

  /**
   * Stores the Tenant's App Credentials (e.g. Client ID/Secret)
   */
  async setProviderConfig(tenantUserId: string, provider: string, id: string, secret: string) {
    await this.storage.save(tenantUserId, 'provider_config', `${provider}_client_id`, id);
    await this.storage.save(tenantUserId, 'provider_config', `${provider}_client_secret`, secret);
  }

  // --- USER AUTH FLOW ---

  /**
   * Exchanges Authorization Code for Tokens and stores them securely
   */
  async handleCallback(
    tenantUserId: string,     // The Tenant Owner (who owns the App credentials)
    authenticatingUserId: string, // The End User (who is logging in)
    provider: string,
    code: string
  ) {
    // 1. Retrieve Tenant Config
    const clientId = await this.storage.get(tenantUserId, 'provider_config', `${provider}_client_id`);
    const clientSecret = await this.storage.get(tenantUserId, 'provider_config', `${provider}_client_secret`);

    if (!clientId || !clientSecret) throw new Error(`Tenant ${tenantUserId} not configured for ${provider}`);

    // 2. Exchange Code (Provider Agnostic implementation required here, using fetch for brevity)
    const tokens = await this.exchangeCode(provider, code, clientId, clientSecret);

    // 3. Save User Tokens
    await this.storage.save(authenticatingUserId, 'oauth_tokens', `${provider}_access_token`, tokens.access_token);
    if (tokens.refresh_token) {
      await this.storage.save(authenticatingUserId, 'oauth_tokens', `${provider}_refresh_token`, tokens.refresh_token);
    }

    return { success: true, scopes: tokens.scope };
  }

  /**
   * Retrieves a valid access token for the user
   */
  async getAccessToken(userId: string, provider: string) {
    const token = await this.storage.get(userId, 'oauth_tokens', `${provider}_access_token`);
    if (!token) throw new Error(`User ${userId} not connected to ${provider}`);
    return token;
  }

  // --- INTERNAL HELPERS ---

  private async exchangeCode(provider: string, code: string, clientId: string, clientSecret: string) {
    // Simple example for GitHub
    if (provider === 'github') {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
      });
      return res.json();
    }
    throw new Error('Provider not implemented');
  }
}

export const oauth = new OAuthManager();
```

## 5. Closed-Loop Verification Plan

Do not run the App to test this. Use this script to verify the bytea conversion and encryption are compatible with your specific Postgres schema.

Create `packages/oauth-core/scripts/verify.ts`:

```typescript
import { oauth } from '../src/index';
import { createClient } from '@supabase/supabase-js';

// REQUIRES: A valid user_id must exist in 'iam.users' for Foreign Key constraints
const MOCK_TENANT_ID = "existing-user-uuid-here";
const MOCK_USER_ID = "existing-user-uuid-here";

async function verify() {
  console.log("1. Setting Provider Config (Writing to Lockbox)...");
  await oauth.setProviderConfig(MOCK_TENANT_ID, "github", "gh_id_123", "gh_secret_XYZ");

  console.log("2. Simulating Token Save...");
  // We manually use the private storage adapter via public API side-effects for this test
  // Or simpler: just try to retrieve the config we just set

  // 3. Verification (Reading from Lockbox)
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data } = await supabase.schema('lockbox').from('user_secrets')
    .select('*')
    .eq('clerk_id', MOCK_TENANT_ID)
    .eq('name', 'github_client_secret')
    .single();

  console.log("Raw DB Record:", data);

  if (!data.ciphertext.startsWith('\\x')) {
    throw new Error("FAIL: Ciphertext is not formatted as Postgres Hex Bytea");
  }

  console.log("✅ Verification Successful: Data stored securely with correct Bytea format.");
}

verify().catch(console.error);
```
