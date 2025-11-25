# OAuth Core Architectural Issues

**Status**: 🔴 OPEN
**Severity**: High (Architectural Debt)
**Component**: `@webalive/oauth-core`
**Created**: 2025-01-24
**Impact**: Security, Maintainability, Scalability

## Problem Statement

The OAuth core package has accumulated significant architectural debt with multiple hard-to-fix code smells that require major refactoring. These issues affect security, testability, and scalability of the entire authentication system.

## Issues Ordered by Difficulty

### 7. SINGLETON ANTI-PATTERN - Global singleton instance

**Why it's hard to fix:**
- Breaking change that would affect all existing code importing and using oauth directly
- Migration path needed with backward compatibility during transition
- Widespread impact requiring every consumer to be updated
- Shared state management needs careful handling

**What needs to be fixed:**

The global singleton pattern in `oauth-core` creates tight coupling where all consumers directly import and use a shared global instance. This prevents proper dependency injection, makes testing difficult (tests can't isolate their OAuth configurations), and creates hidden dependencies throughout the codebase. The singleton makes it impossible to have multiple OAuth configurations running simultaneously, which becomes problematic in multi-tenant scenarios or when different parts of the application need different OAuth behaviors.

What needs fixing is the transition from a global instance to explicit dependency management. Each consumer should receive its OAuth manager through constructor parameters or factory functions rather than importing a global. The configuration should flow through the application's dependency graph explicitly, making dependencies visible and testable. This means the OAuth manager needs to become a service that's instantiated and passed around rather than a globally accessible singleton.

```typescript
// Current problematic pattern - hidden global dependency
import { oauth } from '@webalive/oauth-core'

class SomeService {
  async handleAuth() {
    // Directly uses global singleton - untestable, hidden dependency
    const token = await oauth.refreshTokens('linear', 'user123')
  }
}
```

**How to verify the fix:**

To verify the fix is done correctly, you should be able to instantiate multiple OAuth managers with different configurations in the same process without interference. Tests should be able to create isolated OAuth instances with mock storage adapters. There should be no global state sharing between different OAuth manager instances, and the application should explicitly wire dependencies through its initialization code. A proper fix would allow `const oauth1 = new OAuthManager(config1)` and `const oauth2 = new OAuthManager(config2)` to coexist without conflicts.

---

### 10. MISSING RETRY LOGIC - No retry mechanism for network failures

**Why it's hard to fix:**
- Complex implementation requiring exponential backoff, max retries, and retry condition logic
- Provider-specific concerns with different rate limits and retry recommendations
- Token expiry edge cases where retrying could cause cascading issues
- Configuration overhead as each provider might need different retry strategies

**What needs to be fixed:**

The OAuth core lacks any retry logic for network operations, meaning a temporary network hiccup or provider rate limit immediately fails the entire operation. This is particularly problematic for token refresh operations which are time-sensitive and critical for maintaining user sessions. OAuth providers like Google, GitHub, and Linear all have different rate limiting strategies, maintenance windows, and temporary failures that should be handled gracefully. The system needs to distinguish between retryable failures (network timeout, 503 Service Unavailable) and permanent failures (401 Invalid Credentials).

The missing retry logic needs to implement exponential backoff with jitter to avoid thundering herd problems, respect provider-specific rate limit headers (Retry-After, X-RateLimit-Reset), and have configurable per-provider retry strategies. The system must also handle edge cases like token expiry during retry attempts - if a refresh token operation is being retried but the token expires during the retry window, the system needs to fail gracefully rather than entering an infinite retry loop.

```typescript
// Current problem - immediate failure on any network issue
async refreshTokens(provider: string, userId: string) {
  // Single attempt, fails immediately on any error
  const response = await fetch(tokenEndpoint, { ... })
  if (!response.ok) throw new Error('Token refresh failed')
}

// What's needed - intelligent retry with backoff
async refreshTokens(provider: string, userId: string) {
  // Should handle:
  // - Exponential backoff: 1s, 2s, 4s, 8s...
  // - Respect Retry-After headers
  // - Different strategies for different error codes
  // - Maximum retry window before token expires
}
```

**How to verify the fix:**

Verification of a correct implementation would show that temporary network failures are recovered from automatically, rate limit errors result in appropriate backoff behavior, and permanent errors fail immediately without unnecessary retries. Metrics should show reduced failure rates for transient issues while maintaining fast failure for legitimate errors. The system should have configurable retry policies per provider that can be adjusted without code changes.

---

### 2. RACE CONDITION - Token refresh

**Why it's hard to fix:**
- Requires distributed locking for multi-instance deployments (Redis or similar)
- Complex state management for pending refresh promises
- Error recovery complexity if lock holder crashes mid-refresh
- Performance implications of adding locks

**What needs to be fixed:**

The token refresh mechanism has a critical race condition where multiple concurrent requests for the same user can trigger multiple refresh operations simultaneously. This results in unnecessary API calls to OAuth providers, potential rate limiting, and token confusion where different parts of the application end up with different tokens. In a distributed system with multiple server instances, this problem is amplified as each instance might attempt to refresh the same token independently.

The core issue is the lack of atomic locking around the refresh operation. When a token is being refreshed, all other requests for that same user/provider combination need to wait for the in-progress refresh to complete rather than starting their own. This requires implementing a distributed lock (using Redis or similar) that ensures only one refresh happens at a time, with other requests queuing behind it. The system also needs to handle lock timeout scenarios where the lock holder crashes mid-refresh.

```typescript
// Current race condition
async getValidToken(userId: string) {
  const token = await this.storage.get(`token:${userId}`)
  if (isExpired(token)) {
    // RACE: Multiple requests hit this simultaneously
    return await this.refreshTokens(userId)
  }
  return token
}

// What needs to be prevented
// Request 1: Checks token (expired) -> Starts refresh
// Request 2: Checks token (expired) -> Also starts refresh (PROBLEM!)
// Request 3: Checks token (expired) -> Also starts refresh (PROBLEM!)
// Result: 3 refresh API calls, potentially different tokens
```

**How to verify the fix:**

Proper fix verification would demonstrate that concurrent requests for the same user result in exactly one refresh operation, with all requests receiving the same refreshed token. Load testing should show no duplicate refresh calls even under high concurrency. The system should gracefully handle scenarios where the lock holder crashes, with appropriate timeout and lock recovery mechanisms. Distributed deployments should coordinate properly across instances.

---

### 13. MISSING INTERFACE SEGREGATION - Fat interface with optional methods

**Why it's hard to fix:**
- Breaking change that would affect all existing provider implementations
- Runtime discovery problem where consumers still need to know capabilities
- Migration complexity requiring both patterns during transition
- TypeScript limitations for capability-based interfaces

**What needs to be fixed:**

The OAuth provider interface forces all implementations to handle methods they don't support, violating the Interface Segregation Principle. Providers have vastly different capabilities - some support token refresh, others don't; some have user info endpoints, others don't; some support PKCE, others use client secrets. The current fat interface with optional methods makes it impossible to know at compile time what operations are actually supported, leading to runtime failures and defensive programming throughout the codebase.

What needs fixing is the decomposition of the monolithic provider interface into focused capability interfaces. Providers should implement only the interfaces for capabilities they actually support. Consumers need a way to discover provider capabilities at compile time through TypeScript's type system rather than runtime checks. This enables better IDE support, compile-time safety, and clearer provider documentation.

```typescript
// Current problem - fat interface with optional everything
interface OAuthProvider {
  authorize?(params: AuthParams): Promise<string>
  exchangeCode?(code: string): Promise<TokenSet>
  refreshTokens?(refresh: string): Promise<TokenSet>  // Optional but no way to know
  getUserInfo?(token: string): Promise<UserInfo>      // Optional but no way to know
  revoke?(token: string): Promise<void>              // Optional but no way to know
}

// Usage requires defensive programming
const provider = getProvider('github')
if (provider.refreshTokens) {  // Runtime check, might still fail
  await provider.refreshTokens(token)
} else {
  // Need fallback logic everywhere
}
```

**How to verify the fix:**

Verification of a proper fix would show that attempting to call an unsupported operation results in a compile-time TypeScript error rather than a runtime failure. The type system should guide developers to only use available operations. Provider capabilities should be discoverable through TypeScript's intellisense without consulting documentation. There should be no `method?.()` optional chaining or runtime capability checks in the consuming code.

---

### 14. CRYPTOGRAPHIC KEY DERIVATION - Master key used directly

**Why it's hard to fix:**
- Data migration required with all existing encrypted data needing re-encryption
- Zero-downtime migration complexity
- Key rotation implementation requires versioning and multi-key support
- Performance overhead from key derivation

**What needs to be fixed:**

The encryption system uses the master key directly for all encryption operations without any key derivation, violating cryptographic best practices. This means all data is encrypted with the same key, making it impossible to rotate keys without re-encrypting everything. There's no key versioning, no per-tenant key isolation, and no ability to revoke access to specific data sets. A single key compromise exposes all encrypted data across all users and tenants.

The system needs proper key derivation where the master key is never used directly but instead generates derived keys for specific purposes. Each tenant or data type should have its own derived key, enabling granular access control and rotation. Key versioning must be implemented so encrypted data includes metadata about which key version was used, allowing gradual migration during key rotation. The derivation should use proper KDF (Key Derivation Function) algorithms like HKDF with appropriate salt and context parameters.

```typescript
// Current problem - direct master key usage
class Encryption {
  encrypt(data: string) {
    // PROBLEM: Same key encrypts everything
    return crypto.encrypt(data, this.masterKey)
  }
}

// What's needed - proper key derivation
class Encryption {
  encrypt(data: string, context: { tenant: string, purpose: string }) {
    // Should:
    // - Derive unique key: deriveKey(masterKey, salt, context)
    // - Include key version in output
    // - Never use masterKey directly
    // - Support multiple key versions during rotation
  }
}
```

**How to verify the fix:**

Correct implementation verification would show that different tenants' data is encrypted with different derived keys, key rotation can happen without service interruption, and old encrypted data remains decryptable while new data uses new keys. Security audit should confirm the master key never appears in memory during normal operations, only derived keys. The system should support gradual re-encryption during key rotation without downtime.

---

### 5. ENVIRONMENT VARIABLE COUPLING - Direct env var access

**Why it's hard to fix:**
- Architectural change requiring dependency injection throughout
- Configuration management design needed for how config flows through system
- Testing infrastructure becomes more complex with DI
- Backward compatibility as existing code expects env vars to "just work"

**What needs to be fixed:**

The codebase directly accesses environment variables throughout, creating hidden dependencies and making the system untestable without setting up the exact environment. This tight coupling means configuration can't be validated at startup, different components can't have different configurations, and testing requires manipulating global process state. The direct environment access is scattered across files, making it impossible to understand the system's configuration requirements without reading all the code.

What needs fixing is the centralization of configuration into a validated, typed configuration object that's injected as a dependency. All environment variable access should happen in one place during application initialization, with validation ensuring all required configuration is present and valid before the application starts. Components should receive configuration through their constructors or initialization functions, making dependencies explicit and enabling easy testing with different configurations.

```typescript
// Current problem - scattered env var access
class OAuthManager {
  async encrypt(data: string) {
    // Hidden dependency, fails at runtime if missing
    const key = process.env.ENCRYPTION_KEY
    if (!key) throw new Error('ENCRYPTION_KEY not set')
    // ...
  }
}

// Another file, another hidden dependency
class TokenStorage {
  constructor() {
    // More hidden configuration requirements
    this.ttl = parseInt(process.env.TOKEN_TTL || '3600')
  }
}
```

**How to verify the fix:**

Proper fix verification would show that removing an environment variable causes application startup failure with clear error messages about what's missing, rather than runtime failures deep in the code. Tests should be able to instantiate components with mock configuration without touching process.env. All configuration requirements should be documentable from a single configuration schema. The application should validate configuration completeness and correctness at startup, not during operation.

---

### 12. PROMISE.ALL WITHOUT ERROR BOUNDARY - Parallel operations

**Why it's hard to fix:**
- Error semantics change with partial success handling complexity
- API design questions about returning partial results vs complete failure
- State consistency concerns with partial failures
- Consumer expectations of all-or-nothing behavior

**What needs to be fixed:**

The use of Promise.all for parallel operations means that a single failure in any operation causes the entire batch to fail, with no way to handle partial success. This is problematic when refreshing multiple tokens or performing batch operations where some might succeed while others fail for transient reasons. The current all-or-nothing approach means a single provider's temporary outage can break operations for all other providers, even though they're independent.

The system needs to handle partial failures gracefully, collecting both successes and failures and allowing the caller to decide how to proceed. Operations that are independent should not fail together - if refreshing tokens for three providers and one fails, the other two successful refreshes should still be usable. The error handling needs to distinguish between critical failures that should stop everything and non-critical failures that can be reported while continuing with successful results.

```typescript
// Current problem - all or nothing
async refreshAllTokens(userId: string) {
  const providers = ['github', 'linear', 'google']
  // If Linear is down, GitHub and Google refreshes are lost too
  const results = await Promise.all(
    providers.map(p => this.refreshTokens(p, userId))
  )
}

// What's needed - partial success handling
async refreshAllTokens(userId: string) {
  // Should use Promise.allSettled or similar
  // Should return: {
  //   successful: { github: token, google: token },
  //   failed: { linear: error }
  // }
  // Should let caller decide if partial success is acceptable
}
```

**How to verify the fix:**

Verification of correct implementation would show that operations continue despite individual failures, partial results are properly communicated to callers, and error aggregation provides enough detail to understand what failed and why. Testing should demonstrate that a single provider's failure doesn't cascade to others. The system should provide clear APIs for handling partial success scenarios with appropriate error context for each failure.

---

### 15. MISSING AUDIT TRAIL - No logging

**Why it's hard to fix:**
- Infrastructure requirement for logging storage decisions
- Performance impact from I/O overhead
- Privacy concerns with OAuth tokens and user data
- Compliance requirements vary by regulation
- Log rotation/retention policies needed

**What needs to be fixed:**

The OAuth system performs sensitive security operations like token refresh, credential storage, and authentication flows without any audit trail. There's no way to investigate security incidents, debug production issues, or demonstrate compliance with security requirements. When tokens fail to refresh or authentication breaks, there's no visibility into what happened, making troubleshooting rely entirely on reproducing issues locally. This is particularly critical for OAuth operations which involve external services and security-sensitive data.

The missing audit trail needs to capture security-relevant events (login attempts, token refreshes, authorization grants) with appropriate detail level while respecting privacy requirements. Sensitive data like tokens and passwords must be excluded or redacted from logs while still providing enough context for investigation. The logging needs to include correlation IDs to trace operations across distributed systems, timestamp precision for security analysis, and structured formatting for log aggregation tools.

```typescript
// Current problem - silent operations
async refreshTokens(provider: string, userId: string) {
  const tokens = await this.fetchNewTokens(...)  // No trace of this happening
  await this.storage.store(tokens)               // No record of storage
  return tokens                                  // No audit trail
}

// What needs to be captured
async refreshTokens(provider: string, userId: string) {
  // Should log:
  // - SECURITY: Token refresh initiated for user:xxx provider:linear
  // - DEBUG: Fetching from endpoint: https://api.linear.app/oauth/token
  // - SECURITY: Token refresh successful, expires in 3600s
  // - Or: ERROR: Token refresh failed: 401 Invalid refresh token
  // With: correlation IDs, timestamps, sanitized data
}
```

**How to verify the fix:**

Correct implementation verification would show that security events appear in audit logs with sufficient detail for investigation but without sensitive data exposure, operations can be traced through the system using correlation IDs, and log volume is manageable under normal operations while providing detail during issues. Compliance audit should confirm that all authentication and authorization events are captured with appropriate retention. Performance impact of logging should be minimal with async write patterns.

---

### 1. DRY VIOLATION - validateLinearConfig/validateLinearCredentials

**Why it's hard to fix:**
- Different validation rules might be intentional or accidental
- Evolution divergence over time creates subtle differences
- Testing complexity for shared validation logic

**What needs to be fixed:**

The duplication between validation functions seems simple but hides complex coupling where the same validation rules are implemented differently in different places. These functions likely started identical but evolved separately, accumulating subtle differences that may or may not be intentional. Some validations might be stricter in one place than another, creating inconsistent behavior where credentials pass one validation but fail another. The duplication makes it unclear which validation rules are authoritative and whether differences are bugs or features.

What needs fixing is establishing a single source of truth for validation rules that can be composed differently for different contexts. The validation logic needs to be extracted into reusable, testable units that can be combined as needed. The different validation contexts (config vs credentials) should be explicit about their requirements while sharing common validation logic. Any intentional differences need to be documented and made obvious in the code structure.

```typescript
// Current problem - duplicated validation with drift
function validateLinearConfig(config: any) {
  if (!config.clientId) throw new Error('Missing clientId')
  if (!config.clientSecret) throw new Error('Missing clientSecret')
  if (!config.redirectUri) throw new Error('Missing redirectUri')
  // Some additional validation that may differ...
}

function validateLinearCredentials(creds: any) {
  if (!creds.clientId) throw new Error('Invalid clientId')  // Different error message
  if (!creds.clientSecret) throw new Error('Invalid secret')  // Different field name in error
  // Might have different validation rules that have diverged
}
```

**How to verify the fix:**

Verification of a proper fix would show that changing a validation rule updates it everywhere consistently, validation errors have consistent messages and structure across the system, and the validation requirements are documented in one place. Tests should cover all validation paths through shared test cases. There should be no way for validation logic to drift apart accidentally, with any intentional differences being explicit and documented in the code structure.

## Root Causes

1. **Rapid Development**: Features added quickly without architectural planning
2. **Missing Abstraction Layer**: Direct implementation without proper interfaces
3. **No Design Review**: Architectural decisions made in code without review
4. **Technical Debt Accumulation**: Small compromises compounded over time

## Impact Analysis

### Security Impact
- No audit trail for compliance
- Weak encryption key management
- Race conditions could leak tokens

### Scalability Impact
- Singleton prevents horizontal scaling
- No retry logic causes unnecessary failures
- Missing distributed locking

### Maintainability Impact
- Untestable code due to global state
- Interface violations make changes risky
- Duplicated validation logic

## Implementation Strategy

### Phase 1: Critical Security Fixes
1. Add distributed locking for token refresh (Race Condition)
2. Implement audit logging (Missing Audit Trail)
3. Add key derivation for encryption (Cryptographic Issues)

### Phase 2: Architecture Refactoring
1. Extract configuration to DI container (Environment Coupling)
2. Create capability-based interfaces (Interface Segregation)
3. Implement retry logic with circuit breakers (Missing Retry)

### Phase 3: Breaking Changes
1. Remove singleton pattern (requires major version bump)
2. Implement proper error boundaries (Promise.all issues)
3. Consolidate validation logic (DRY violations)

## Testing Requirements

Each fix must include:
- Unit tests for new functionality
- Integration tests for OAuth flows
- Load tests for race conditions
- Security tests for encryption changes
- Migration tests for breaking changes

## Migration Path

1. Create feature flags for new implementations
2. Run old and new code in parallel (shadow mode)
3. Gradually migrate traffic to new implementation
4. Remove old code after validation period

## Success Criteria

- [ ] All OAuth operations have audit logs
- [ ] No duplicate token refreshes under load
- [ ] Tests can mock OAuth without env vars
- [ ] Different tenants use different encryption keys
- [ ] Retry logic reduces failure rate by >50%
- [ ] All provider capabilities known at compile time
- [ ] Zero singleton imports in new code

## Related Documents

- [Architecture Overview](../architecture/README.md)
- [Security Patterns](../security/README.md)
- [Testing Guide](../testing/README.md)