# @webalive/oauth-core

Secure, multi-tenant OAuth system using the Supabase lockbox pattern with AES-256-GCM encryption.

## Features

- 🔐 **Secure**: AES-256-GCM encryption with 12-byte IV and 16-byte auth tag
- 🏢 **Multi-tenant**: Separate provider configs per tenant
- 📦 **Lockbox Pattern**: Utilizes `lockbox.user_secrets` schema in Supabase
- 🔌 **Extensible**: Provider abstraction for GitHub, Google, etc.
- 🧪 **Type-safe**: Full TypeScript support
- 🎯 **Zero Dependencies**: Only requires `@supabase/supabase-js` and `zod`

## Installation

```bash
bun add @webalive/oauth-core
```

## Setup

### 1. Environment Variables

Create a `.env` file with the following:

```bash
# Supabase Connection (Required)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="eyJ..."  # Service role key (bypasses RLS)

# Security (Required - Generate with: openssl rand -hex 32)
LOCKBOX_MASTER_KEY="your_64_character_hex_string_here"
```

**Generate a secure master key:**
```bash
openssl rand -hex 32
```

### 2. Database Schema

Run the schema setup script programmatically:

```bash
# Set Supabase credentials (from dashboard Settings > API)
export SUPABASE_PROJECT_ID="your-project-id"
export SUPABASE_ACCESS_TOKEN="your-access-token"

# Run setup
bun run setup-schema
```

This creates:
- `lockbox` schema
- `lockbox.user_secrets` table with encryption fields
- RLS policies and indexes
- Triggers and permissions

## Usage

### Basic Example

```typescript
import { oauth } from '@webalive/oauth-core';

// 1. Configure OAuth provider (tenant setup)
await oauth.setProviderConfig('tenant-user-id', 'github', {
  client_id: 'Iv1.abc123',
  client_secret: 'your_github_app_secret',
  redirect_uri: 'https://yourapp.com/auth/callback',
});

// 2. Get authorization URL (redirect user)
const authUrl = await oauth.getAuthUrl(
  'tenant-user-id',
  'github',
  'repo user',
  'random-state-for-csrf'
);
// Redirect user to authUrl

// 3. Handle callback (exchange code for tokens)
const result = await oauth.handleCallback(
  'tenant-user-id',      // Tenant who owns the OAuth app
  'end-user-id',         // User who is authenticating
  'github',
  req.query.code
);

// 4. Use access token
const token = await oauth.getAccessToken('end-user-id', 'github');

// Make API calls with token
const res = await fetch('https://api.github.com/user', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Full API Reference

#### Tenant Configuration

```typescript
// Set provider credentials
await oauth.setProviderConfig(tenantUserId, 'github', {
  client_id: 'your_client_id',
  client_secret: 'your_client_secret',
  redirect_uri: 'https://yourapp.com/callback',
});

// Get provider credentials
const config = await oauth.getProviderConfig(tenantUserId, 'github');

// Delete provider credentials
await oauth.deleteProviderConfig(tenantUserId, 'github');
```

#### User Authentication

```typescript
// Get authorization URL
const authUrl = await oauth.getAuthUrl(
  tenantUserId,
  'github',
  'repo user',  // Scopes
  'csrf-state'  // CSRF protection
);

// Handle OAuth callback
const result = await oauth.handleCallback(
  tenantUserId,
  userId,
  'github',
  authorizationCode
);

// Get access token
const token = await oauth.getAccessToken(userId, 'github');

// Check if user is connected
const connected = await oauth.isConnected(userId, 'github');

// Get refresh token (if available)
const refreshToken = await oauth.getRefreshToken(userId, 'github');

// Disconnect user
await oauth.disconnect(userId, 'github');

// Revoke token with provider
await oauth.revoke(tenantUserId, userId, 'github');
```

## Supported Providers

- ✅ **GitHub** - OAuth Apps and GitHub Apps
- 🔜 **Google** - Coming soon
- 🔜 **Microsoft** - Coming soon

### Adding Custom Providers

```typescript
import { registerProvider, type OAuthProvider } from '@webalive/oauth-core';

class CustomProvider implements OAuthProvider {
  name = 'custom';

  async exchangeCode(code, clientId, clientSecret, redirectUri) {
    // Implementation
  }

  // Optional: refreshToken, revokeToken, getAuthUrl
}

registerProvider('custom', new CustomProvider());
```

## Architecture

### Data Flow

1. **Tenant Setup**: Store OAuth app credentials encrypted in `lockbox.user_secrets` with namespace `provider_config`
2. **User Auth**: Exchange authorization code for tokens
3. **Token Storage**: Encrypt and store user tokens with namespace `oauth_tokens`
4. **Token Usage**: Decrypt tokens on-demand for API calls

### Database Schema

```
lockbox.user_secrets
├── secret_id (UUID)
├── clerk_id (UUID FK to iam.users)
├── namespace ('provider_config' | 'oauth_tokens')
├── name (e.g., 'github_client_secret')
├── ciphertext (BYTEA - encrypted data)
├── iv (BYTEA - 12 bytes)
├── auth_tag (BYTEA - 16 bytes)
├── version (INT)
├── is_current (BOOLEAN)
└── created_at, updated_at
```

### Security Model

- **Encryption**: AES-256-GCM (authenticated encryption)
- **Key Management**: Single master key from environment
- **Storage Format**: Postgres bytea hex (`\x...`)
- **Access Control**: Supabase RLS + service key for writes

See [SECURITY.md](./SECURITY.md) for detailed security information.

## Testing

### Unit Tests

```bash
# Run tests
bun test

# Watch mode
bun run test:watch

# With coverage
bun test --coverage
```

### Verification Script

```bash
# Set test user IDs (must exist in iam.users)
export TEST_TENANT_ID="uuid-here"
export TEST_USER_ID="uuid-here"

# Run verification
bun run verify
```

## Development

```bash
# Install dependencies
bun install

# Build package
bun run build

# Type check
bun run type-check

# Watch mode
bun run dev
```

## Integration with Next.js

### Example Route Handler

```typescript
// app/api/auth/github/callback/route.ts
import { NextRequest } from 'next/server';
import { oauth } from '@webalive/oauth-core';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const userId = req.headers.get('x-user-id'); // From your auth

  if (!code || !userId) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    await oauth.handleCallback(userId, userId, 'github', code);
    return Response.redirect('/dashboard?connected=github');
  } catch (error) {
    return Response.json({ error: 'OAuth failed' }, { status: 500 });
  }
}
```

## Troubleshooting

### "Invalid configuration" error

Ensure all environment variables are set:
- `SUPABASE_URL` - Full Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (not anon key)
- `LOCKBOX_MASTER_KEY` - 64 hex characters (32 bytes)

### "Foreign key constraint violation"

The `clerk_id` must reference an existing user in `iam.users` table. Ensure users exist before storing secrets.

### "Decryption failed"

This usually means:
1. Master key changed (data encrypted with different key)
2. Data corruption in database
3. Incorrect bytea format

## Security Best Practices

1. **Master Key**: Store in secure environment variables, never commit to git
2. **Service Key**: Only use server-side, never expose to client
3. **Key Rotation**: Plan for key rotation using the `version` and `is_current` fields
4. **Scopes**: Request minimal OAuth scopes needed
5. **State Parameter**: Always use CSRF state parameter in OAuth flows

## License

MIT

## Support

For issues and questions, please file an issue on GitHub.
