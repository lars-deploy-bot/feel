# OAuth Core Architectural Issues

**Status**: 🟢 MOSTLY RESOLVED
**Severity**: Low (Reduced from High - all critical issues fixed)
**Component**: `@webalive/oauth-core`
**Created**: 2025-01-24
**Last Updated**: 2026-02-01
**Impact**: Security, Maintainability, Scalability

## Summary

The OAuth core package had accumulated architectural debt. **All critical issues have been resolved:**

- ✅ Race conditions → Distributed locking (`refresh-lock.ts`)
- ✅ Interface segregation → Capability interfaces with type guards
- ✅ Retry logic → All providers use `fetchWithRetry()`
- ✅ Audit trail → Structured logging (`audit.ts`)
- ✅ Key derivation → HKDF per-tenant keys (`key-derivation.ts`)
- ✅ Environment coupling → Centralized config (`config.ts`)
- 🟡 Singleton pattern → Factory exists, migration ongoing

## Resolved Issues

### ✅ RACE CONDITION - Token refresh (FIXED 2026-01)

**Resolution**: Implemented in `src/refresh-lock.ts`

The token refresh race condition has been fully addressed with a two-tier locking system:

1. **InMemoryRefreshLockManager** - For single-instance deployments
   - Uses in-memory Map with TTL-based cleanup
   - Pending requests wait on the same Promise (no duplicate refreshes)

2. **RedisRefreshLockManager** - For distributed/multi-instance deployments
   - Atomic lock acquisition via Redis `SET NX EX`
   - Lua script for safe lock release (only owner can release)
   - Proper timeout handling and crash recovery

**Key implementation details:**
- Lock key format: `oauth:refresh_lock:{userId}:{provider}`
- Lock TTL: 30 seconds
- Double-check pattern: After acquiring lock, re-reads token to avoid duplicate refresh
- Auto-detection: Uses Redis if `REDIS_URL` is set, otherwise falls back to memory with warning

**Verification**: See `test/rotation-safety.test.ts` for concurrent rotation tests.

---

### ✅ INTERFACE SEGREGATION - Fat interface (FIXED 2026-01)

**Resolution**: Implemented in `src/providers/base.ts`

The monolithic provider interface has been decomposed into focused capability interfaces:

```typescript
// Core interface - ALL providers must implement
interface OAuthProviderCore {
  name: string
  exchangeCode(...): Promise<OAuthTokens>
  getAuthUrl(...): string
}

// Optional capabilities - implement only if supported
interface OAuthRefreshable {
  refreshToken(...): Promise<OAuthTokens>
}

interface OAuthRevocable {
  revokeToken(...): Promise<void>
}

// Type guards for runtime capability checking
function isRefreshable(provider): provider is OAuthProviderCore & OAuthRefreshable
function isRevocable(provider): provider is OAuthProviderCore & OAuthRevocable
```

**Usage in OAuthManager** (line 278 in index.ts):
```typescript
if (!isRefreshable(oauthProvider)) {
  throw new Error(`Provider '${provider}' does not support token refresh.`)
}
```

---

### ✅ RETRY LOGIC - All providers (FIXED 2026-02-01)

**Resolution**: Implemented shared `fetchWithRetry()` in `src/fetch-with-retry.ts`

All OAuth providers now use consistent retry logic:
- ✅ **Google provider**: Uses shared `fetchWithRetry()`
- ✅ **Linear provider**: Uses shared `fetchWithRetry()`
- ✅ **GitHub provider**: Uses shared `fetchWithRetry()`
- ✅ **Stripe provider**: Uses shared `fetchWithRetry()`

**Implementation details:**
- Uses `retryAsync()` from `@webalive/shared` for consistent behavior
- Exponential backoff: 1s, 2s, 4s... up to 10s max
- Jitter: 10% randomization to prevent thundering herd
- Only retries on 5xx errors and network failures (not 4xx client errors)
- Custom `FetchRetryError` class carries HTTP status through retry logic
- Labeled logging: `[Google] Retry 1/3 after 1000ms (503)`

---

## Open Issues

### 7. SINGLETON ANTI-PATTERN - Global singleton instance

**Severity**: Medium
**Effort**: High (breaking change)

The global singleton `export const oauth = new OAuthManager()` creates tight coupling. However, the codebase now supports both patterns:

```typescript
// Legacy singleton (still works, deprecated)
import { oauth } from '@webalive/oauth-core'

// Recommended: explicit instantiation
import { createOAuthManager, OAuthManager } from '@webalive/oauth-core'
const oauth = createOAuthManager({ instanceId: 'my-app', ... })
```

**Current state**: The singleton is marked deprecated but still used in web app. Tests use `createOAuthManager()` for isolation.

---

---

### ✅ KEY DERIVATION - HKDF implementation (FIXED 2026-02-01)

**Resolution**: Implemented in `src/key-derivation.ts` and `src/security.ts`

The encryption system now uses HKDF (HMAC-based Key Derivation Function) for tenant-isolated keys:

1. **KeyDerivationContext** - Per-tenant key derivation
   - `tenantId`: User/org ID for isolation
   - `purpose`: Key purpose (e.g., "oauth_tokens", "user_env_keys")
   - `extra`: Optional additional context (e.g., provider name)

2. **Key Versioning** - Backward-compatible migration
   - v1: Master key used directly (legacy, for reading old data)
   - v2: HKDF-derived keys per context (current)
   - Metadata stored with ciphertext: `v2:tenantId:purpose:extra`

3. **Security.encryptWithContext()** - New encryption with derived keys
   ```typescript
   const encrypted = Security.encryptWithContext(plaintext, {
     tenantId: "user-123",
     purpose: "oauth_tokens",
     extra: "linear"
   })
   // Returns: { ciphertext, iv, authTag, keyMeta: "v2:user-123:oauth_tokens:linear" }
   ```

4. **Security.decrypt()** - Handles both v1 and v2
   - Parses keyMeta to determine version
   - v1/no metadata: uses master key directly
   - v2: derives key from stored context

**Key files:**
- `src/key-derivation.ts` - HKDF implementation, context types, metadata serialization
- `src/security.ts` - Updated with `encryptWithContext()` and v1/v2 `decrypt()`

**Migration path:** New data uses v2, old v1 data remains readable. Re-encryption can happen gradually.

---

### ✅ ENVIRONMENT VARIABLE COUPLING (ALREADY RESOLVED)

**Status**: Already implemented correctly in `src/config.ts`

The configuration is already centralized with Zod validation at module load:

```typescript
// src/config.ts - Single source of truth
const configSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  LOCKBOX_MASTER_KEY: z.string().length(64),
})

// Fails fast at startup - NOT during operation
const cachedConfig: Config = validateConfig()
export function getConfig(): Config { return cachedConfig }
```

**What's working:**
- All critical config validated at module load time
- Clear error messages with Zod formatting
- Single `getConfig()` and `getMasterKey()` exports
- Optional overrides (like `REDIS_URL`) handled via function parameters

---

### ✅ PROMISE.ALL - Not Applicable

**Status**: No problematic batch operations exist

The documented concern about `refreshAllTokens()` failing across providers doesn't apply - no such batch refresh function exists. Current `Promise.all` usage is for internal storage operations that correctly fail together:

```typescript
// getProviderConfig - reads from same storage (correct)
const [clientId, clientSecret, redirectUri] = await Promise.all([
  this.storage.get(tenantUserId, "provider_config", `${provider}_client_id`),
  this.storage.get(tenantUserId, "provider_config", `${provider}_client_secret`),
  this.storage.get(tenantUserId, "provider_config", `${provider}_redirect_uri`),
])
```

If batch multi-provider operations are added in the future, they should use `Promise.allSettled`.

---

### ✅ AUDIT TRAIL (FIXED 2026-02-01)

**Resolution**: Implemented in `src/audit.ts` with integration in `OAuthManager`

Structured audit logging now captures all OAuth security events:

```typescript
// Event types
type OAuthAuditEventType =
  | "auth_initiated" | "auth_completed" | "auth_failed"
  | "token_refresh_started" | "token_refresh_completed" | "token_refresh_failed"
  | "token_revoked" | "provider_config_updated" | "user_env_key_updated"

// Usage in OAuthManager
oauthAudit.authCompleted({ userId, provider, correlationId })
oauthAudit.tokenRefreshFailed({ userId, provider, error, correlationId })
```

**Features:**
- Correlation IDs for tracing across requests
- User IDs masked for privacy (first 8 chars only)
- No sensitive data (tokens, secrets) logged
- Structured JSON output for log aggregation
- Integrated into `handleCallback()`, `getAccessToken()` (refresh), and `revoke()`

---

### ✅ DRY VIOLATION - Not Found in Codebase

**Status**: The described `validateLinearConfig/validateLinearCredentials` duplication does not exist

Searched for validation duplication patterns - no matches found. Each module has its own appropriately scoped validation:

- `config.ts`: Zod schema for environment configuration (validated at startup)
- `security.ts`: Buffer length validation for crypto operations
- `key-derivation.ts`: Master key length validation

## Progress Summary

| Issue | Status | Notes |
|-------|--------|-------|
| Race Condition | ✅ Fixed | `refresh-lock.ts` with Redis support |
| Interface Segregation | ✅ Fixed | `OAuthProviderCore` + capability interfaces |
| Retry Logic | ✅ Fixed | All providers use `fetchWithRetry()` |
| Audit Trail | ✅ Fixed | `audit.ts` with structured events |
| Key Derivation | ✅ Fixed | HKDF in `key-derivation.ts`, v1/v2 versioning |
| Environment Coupling | ✅ Fixed | Already centralized in `config.ts` |
| Promise.all Errors | ✅ N/A | No batch multi-provider operations exist |
| DRY Violations | ✅ N/A | Described duplication not found |
| Singleton Pattern | 🟡 Partial | Factory exists, singleton deprecated |

## Impact Analysis (Updated)

### Security Impact
- ~~Race conditions could leak tokens~~ ✅ Fixed
- ~~No audit trail for compliance~~ ✅ Fixed
- ~~Weak encryption key management~~ ✅ Fixed (HKDF)

### Scalability Impact
- ~~Missing distributed locking~~ ✅ Fixed (Redis support)
- ~~Singleton prevents horizontal scaling~~ 🟡 Mitigated (factory available)
- ~~Partial retry logic causes some unnecessary failures~~ ✅ Fixed

### Maintainability Impact
- ~~Interface violations make changes risky~~ ✅ Fixed
- ~~Untestable code due to env var coupling~~ ✅ Fixed (`config.ts` centralizes)
- ~~Duplicated validation logic~~ ✅ N/A (not found)

## Implementation Strategy

### Phase 1: Quick Wins ✅ COMPLETE
1. ~~Add distributed locking for token refresh~~ ✅ Done
2. ~~Create capability-based interfaces~~ ✅ Done
3. ~~Add retry logic to Linear/GitHub/Stripe providers~~ ✅ Done (2026-02-01)

### Phase 2: Security Hardening ✅ COMPLETE
1. ~~Implement audit logging (structured, redacted)~~ ✅ Done (2026-02-01)
2. ~~Add key derivation for encryption (HKDF)~~ ✅ Done (2026-02-01)

### Phase 3: Architecture Cleanup ✅ COMPLETE
1. ~~Extract configuration to DI container~~ ✅ Already done (`config.ts`)
2. Replace singleton imports with factory usage (ongoing migration)
3. ~~Use Promise.allSettled for batch operations~~ ✅ N/A (no batch ops exist)
4. ~~Consolidate validation logic~~ ✅ N/A (no duplication found)

## Success Criteria

- [x] All OAuth operations have audit logs
- [x] No duplicate token refreshes under load
- [x] Config validated at startup (fail-fast)
- [x] Different tenants use different encryption keys
- [x] Retry logic on all providers (not just Google)
- [x] All provider capabilities known at compile time
- [ ] Zero singleton imports in new code (ongoing migration)

## Remaining Work

The only remaining issue is the singleton pattern migration. The singleton `oauth` export still exists for backward compatibility, but new code should use `createOAuthManager()`:

```typescript
// Deprecated (still works)
import { oauth } from '@webalive/oauth-core'

// Recommended
import { createOAuthManager } from '@webalive/oauth-core'
const oauth = createOAuthManager({ instanceId: 'my-app' })
```

## Related Documents

- [Architecture Overview](../architecture/README.md)
- [Security Patterns](../security/README.md)
- [Testing Guide](../testing/README.md)
- [refresh-lock.ts](../../packages/oauth-core/src/refresh-lock.ts) - Lock implementation
- [rotation-safety.test.ts](../../packages/oauth-core/test/rotation-safety.test.ts) - Concurrency tests
- [audit.ts](../../packages/oauth-core/src/audit.ts) - Audit logging
- [key-derivation.ts](../../packages/oauth-core/src/key-derivation.ts) - HKDF implementation
- [fetch-with-retry.ts](../../packages/oauth-core/src/fetch-with-retry.ts) - Retry utility