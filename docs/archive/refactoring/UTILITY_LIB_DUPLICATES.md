# Utility & Library Duplicate Code Analysis

## Executive Summary

**Total Estimated Duplicate Lines:** 350-450 lines
**Areas Analyzed:** `apps/web/lib/`, `packages/*/`
**Priority Level:** HIGH - Critical for security consistency and configuration management

---

## Critical Duplications (Security & Configuration)

### 1. Environment Constants (Configuration)
**Impact:** 30+ files
**Priority:** CRITICAL - Single source of truth needed

**SERVER_IP = "YOUR_SERVER_IP"** duplicated in:
- `scripts/sites/deploy-site-systemd.sh` (line 31)
- `scripts/sites/add-verification-files.sh` (line 8)
- `packages/deploy-scripts/src/dns/validation.ts` (line 5)
- `packages/site-controller/src/config.ts` (line 40)

**WILDCARD_DOMAIN = "alive.best"** duplicated in:
- `packages/deploy-scripts/src/dns/validation.ts` (line 4)
- `packages/site-controller/src/config.ts` (line 43)
- `apps/web/lib/config.ts` (line 1)

**WORKSPACE_BASE = "/srv/webalive/sites"** duplicated in:
- `apps/web/lib/config.ts` (line 3)
- `apps/web/lib/env.ts` (line 46)
- `packages/site-controller/src/config.ts` (line 11)
- `packages/tools/src/lib/workspace-validator.ts` (line 11)
- 26+ more files

**MIN_PORT = 3333, MAX_PORT = 3999** duplicated in:
- `packages/deploy-scripts/src/ports/registry.ts` (lines 5-6)
- `packages/site-controller/src/config.ts` (lines 47-48)

**Solution:**
Create central configuration package:
```typescript
// packages/config/src/index.ts
export const SERVER_CONFIG = {
  IP: "YOUR_SERVER_IP",
  WILDCARD_DOMAIN: "alive.best",
  WORKSPACE_BASE: "/srv/webalive/sites",
  PORT_RANGE: {
    MIN: 3333,
    MAX: 3999,
  },
} as const
```

**Migration:**
1. Create `@alive-brug/config` package
2. Export all infrastructure constants
3. Update all imports
4. Remove hardcoded values

---

### 2. Security Check Pattern (Client-Side Import Prevention)
**Impact:** 5+ files, ~35 lines
**Priority:** CRITICAL - Security consistency

**Files:**
- `apps/web/lib/supabase/server.ts` (lines 1-6)
- `apps/web/lib/supabase/app.ts` (lines 7-13)
- `apps/web/lib/supabase/iam.ts` (lines 7-13)
- `apps/web/lib/supabase/server-rls.ts` (lines 1-3)
- `apps/web/lib/env/server.ts` (lines 2-8)

**Pattern:**
```typescript
const isTestEnv = process.env.NODE_ENV === "test" || "vi" in globalThis
if (typeof window !== "undefined" && !isTestEnv) {
  throw new Error(
    "[SECURITY] ... cannot be imported in client-side code. ..."
  )
}
```

**Solution:**
```typescript
// packages/security/src/assert-server-only.ts
export function assertServerOnly(moduleName: string): void {
  const isTestEnv = process.env.NODE_ENV === "test" || "vi" in globalThis
  if (typeof window !== "undefined" && !isTestEnv) {
    throw new Error(
      `[SECURITY] ${moduleName} cannot be imported in client-side code. ` +
      `This module contains server-only functionality that must not be exposed to the browser.`
    )
  }
}

// Usage:
// Top of server-only files
assertServerOnly("lib/supabase/server")
```

---

### 3. Workspace Path Validation
**Impact:** Multiple files with scattered validation
**Priority:** CRITICAL - Security boundary

**Best implementation:**
- `packages/tools/src/lib/workspace-validator.ts` (lines 18-38)

**Issue:** Similar logic scattered in API route handlers

**Solution:**
- Ensure all code imports from `packages/tools/src/lib/workspace-validator.ts`
- Do NOT reimplement validation logic
- Add to shared security package

---

## High Priority Duplications

### 4. Groq Client with Retry Logic
**Impact:** 2 files, ~55 lines (99% identical)
**Priority:** HIGH

**Files:**
- `apps/web/lib/clients/groq.ts` (58 lines)
- `packages/tools/src/lib/groq-client.ts` (55 lines)

**Duplicated Code:**
- `getGroqClient()` function (lazy initialization)
- `withRetry()` function (exponential backoff: 1s, 2s, 4s)
- Same error handling and logging

**Solution:**
Move to shared package:
```typescript
// packages/ai-clients/src/groq.ts
export function getGroqClient(): Groq
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries?: number
): Promise<T>
```

**Migration:**
1. Create `@alive-brug/ai-clients` package
2. Move Groq client there
3. Update imports in both locations
4. Delete duplicates

---

### 5. Port Listening Check
**Impact:** 2 files, ~21 lines per occurrence
**Priority:** HIGH

**Files:**
- `packages/deploy-scripts/src/orchestration/utils.ts` (lines 13-33)
- `packages/deploy-scripts/src/ports/registry.ts` (lines 75-95)

**Code:**
```typescript
export async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "localhost" })
    socket.setTimeout(100)

    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })

    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })

    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
  })
}
```

**Solution:**
Extract to `packages/deploy-scripts/src/utils/network.ts` and import from both locations.

---

### 6. Exponential Backoff Retry Logic
**Impact:** 3 files, ~136 lines total
**Priority:** HIGH

**Files:**
- `apps/web/lib/retry.ts` - `retryWithBackoff()` (76 lines, sophisticated)
- `apps/web/lib/clients/groq.ts` - `withRetry()` (30 lines, simple)
- `packages/tools/src/lib/groq-client.ts` - `withRetry()` (30 lines, simple)

**Solution:**
Consolidate into sophisticated version:
```typescript
// packages/async-utils/src/retry.ts
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T>

// Groq clients use this instead of reimplementing
```

---

### 7. Supabase Client Creation Pattern
**Impact:** 3 files, ~75 lines
**Priority:** HIGH

**Files:**
- `apps/web/lib/supabase/server.ts` (34 lines)
- `apps/web/lib/supabase/app.ts` (48 lines)
- `apps/web/lib/supabase/iam.ts` (79 lines)

**Shared cookie handling pattern (~25 lines duplicated):**
```typescript
createServerClient<Database>(url, key, {
  db: { schema: "..." },
  cookies: {
    getAll() { return cookieStore.getAll() },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      } catch {
        // Called from Server Component
      }
    }
  }
})
```

**Solution:**
Extract cookie configuration:
```typescript
// lib/supabase/factory.ts
export function createSupabaseServerClient<DB>(
  url: string,
  key: string,
  schema?: string
): SupabaseClient<DB>
```

---

## Medium Priority Duplications

### 8. Supabase Credentials Getter
**Impact:** 3 files, ~45-75 lines
**Priority:** MEDIUM

**Files:**
- `apps/web/lib/env/server.ts` - `getSupabaseCredentials()` (lines 16-40)
- `apps/web/lib/env/client.ts` - `getSupabaseCredentials()` (lines 6-22)
- `apps/web/lib/deployment/domain-registry.ts` - `getSupabaseCredentials()` (lines 43-52)

**Differences:**
- Server: handles both anon and service role keys
- Client: handles NEXT_PUBLIC_ prefixed vars
- Registry: standalone without Next.js dependencies

**Solution:**
Keep different versions but extract shared validation schema. Consider factory pattern:
```typescript
// lib/env/factory.ts
export function getSupabaseCredentials(
  context: 'server' | 'client' | 'standalone'
): SupabaseCredentials
```

---

### 9. Custom Error Classes
**Impact:** 5 files, ~60 lines
**Priority:** MEDIUM

**Files:**
- `apps/web/lib/errors.ts` - `HttpError` (16 lines)
- `apps/web/lib/utils/network.ts` - `NetworkError` (11 lines)
- `packages/deploy-scripts/src/orchestration/errors.ts` - `DeploymentError` (7 lines)
- `packages/site-controller/src/executors/common.ts` - `ScriptError` (18 lines)
- `apps/web/lib/deployment/domain-registry.ts` - `DomainRegistrationError` (lines 144-154)

**Common pattern:**
```typescript
export class CustomError extends Error {
  constructor(message: string, public additionalField: string) {
    super(message)
    this.name = "CustomError"
  }
}
```

**Solution:**
Create base error factory:
```typescript
// packages/errors/src/factory.ts
export function createErrorClass<T extends Record<string, any>>(
  name: string,
  fields: (keyof T)[]
): new (message: string, data: T) => Error

// Or abstract base class:
export abstract class BaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

// Usage:
export class HttpError extends BaseError {
  constructor(message: string, public status: number) {
    super(message)
  }
}
```

---

## Low Priority Duplications

### 10. cn() Utility Function
**Impact:** 2 files, ~3 lines
**Priority:** LOW

**Files:**
- `apps/web/lib/utils.ts` (lines 4-6)
- `packages/template/user/src/lib/utils.ts` (lines 4-6)

**Code:**
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Solution:**
Create shared UI utils package:
```typescript
// packages/ui-utils/src/cn.ts
export function cn(...inputs: ClassValue[])
```

---

### 11. Delay/Sleep Functions
**Impact:** 2 files, ~3 lines
**Priority:** LOW

**Files:**
- `packages/deploy-scripts/src/orchestration/utils.ts` - `delay(ms)`
- `apps/web/lib/retry.ts` - `sleep(ms)`

**Code:**
```typescript
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

**Solution:**
Consolidate into async utilities:
```typescript
// packages/async-utils/src/sleep.ts
export function sleep(ms: number): Promise<void>
```

---

## Consolidation Recommendations

### Phase 1: Critical Infrastructure (Week 1)
**Priority:** CRITICAL
**Impact:** Security + consistency

1. **Create `@alive-brug/config` package**
   - Export all infrastructure constants
   - Migrate 30+ files
   - Remove hardcoded values

2. **Create `@alive-brug/security` package**
   - `assertServerOnly()` function
   - Workspace path validation
   - Migrate 5+ server-only modules

3. **Standardize workspace validation**
   - Ensure all imports from `packages/tools`
   - Remove duplicate validation logic

---

### Phase 2: Client Libraries (Week 2)
**Priority:** HIGH
**Impact:** Code reuse + maintainability

4. **Create `@alive-brug/ai-clients` package**
   - Groq client with retry
   - Remove duplicates

5. **Extract network utilities**
   - Port listening check
   - Move to `packages/deploy-scripts/src/utils/network.ts`

6. **Create `@alive-brug/async-utils` package**
   - Exponential backoff retry
   - Sleep/delay function
   - Remove duplicates

---

### Phase 3: Supabase & Database (Week 3)
**Priority:** MEDIUM
**Impact:** Consistency

7. **Extract Supabase client factory**
   - Cookie configuration
   - Client creation helpers

8. **Standardize credentials getter**
   - Factory pattern for different contexts
   - Shared validation schema

---

### Phase 4: Error Handling (Week 4)
**Priority:** LOW-MEDIUM
**Impact:** DX improvement

9. **Create base error classes**
   - Abstract BaseError
   - Error factory function

10. **Create `@alive-brug/ui-utils` package**
    - cn() utility
    - Other shared UI utilities

---

## New Package Structure

```
packages/
├── config/
│   ├── src/
│   │   └── index.ts        # SERVER_IP, WORKSPACE_BASE, etc.
│   └── package.json
├── security/
│   ├── src/
│   │   ├── assert-server-only.ts
│   │   └── workspace-validation.ts
│   └── package.json
├── ai-clients/
│   ├── src/
│   │   └── groq.ts
│   └── package.json
├── async-utils/
│   ├── src/
│   │   ├── retry.ts
│   │   └── sleep.ts
│   └── package.json
├── errors/
│   ├── src/
│   │   ├── base.ts
│   │   └── factory.ts
│   └── package.json
└── ui-utils/
    ├── src/
    │   └── cn.ts
    └── package.json
```

---

## Migration Checklist

- [ ] Phase 1: Create config and security packages (Week 1)
  - [ ] Create `@alive-brug/config`
  - [ ] Migrate infrastructure constants (30+ files)
  - [ ] Create `@alive-brug/security`
  - [ ] Migrate server-only assertions (5+ files)
  - [ ] Consolidate workspace validation

- [ ] Phase 2: Client libraries (Week 2)
  - [ ] Create `@alive-brug/ai-clients`
  - [ ] Migrate Groq client (2 files)
  - [ ] Extract network utilities
  - [ ] Create `@alive-brug/async-utils`
  - [ ] Migrate retry and sleep functions (3 files)

- [ ] Phase 3: Supabase (Week 3)
  - [ ] Extract Supabase client factory (3 files)
  - [ ] Standardize credentials getter (3 files)

- [ ] Phase 4: Cleanup (Week 4)
  - [ ] Create base error classes (5 files)
  - [ ] Create `@alive-brug/ui-utils`
  - [ ] Update documentation
  - [ ] Update contributing guide

---

## Testing Strategy

For each new package:
1. Write unit tests for exported functions
2. Test in isolation before migration
3. Migrate one consumer at a time
4. Run integration tests
5. Update documentation

---

## Summary Statistics

| Category | Files Affected | Lines Duplicated | Priority |
|----------|---------------|------------------|----------|
| Configuration constants | 30+ | ~50 | Critical |
| Security checks | 5+ | ~35 | Critical |
| Groq client | 2 | ~55 | High |
| Port checking | 2 | ~42 | High |
| Retry logic | 3 | ~136 | High |
| Supabase clients | 3 | ~75 | High |
| Credentials getters | 3 | ~65 | Medium |
| Error classes | 5 | ~60 | Medium |
| cn() utility | 2 | ~3 | Low |
| Sleep/delay | 2 | ~3 | Low |

**Total:** 350-450 lines of duplication across 57+ files
