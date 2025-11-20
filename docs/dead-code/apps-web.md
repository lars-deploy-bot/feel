# Dead Code Analysis: apps/web

**Scope:** `/root/webalive/claude-bridge/apps/web/`
**Date:** 2025-11-20

## Critical Findings - Duplicate Type Definitions

### 1. Duplicate DeploySubdomainRequest Schema

**Location 1:** `types/guards/deploy-subdomain.ts` (lines 7-21)
```typescript
export const DeploySubdomainSchema = z.object({
  domain: z.string(),
  subdomain: z.string(),
  templateChoice: z.enum(['default', 'copy-domain'])
    .optional()
    .default('default'),
  copyFromDomain: z.string().optional(),
  userEmail: z.string().email().optional(),
})

export type DeploySubdomainRequest = z.infer<typeof DeploySubdomainSchema>
```

**Location 2:** `features/deployment/types/guards.ts` (same definition)
```typescript
export const DeploySubdomainSchema = z.object({
  domain: z.string(),
  subdomain: z.string(),
  templateChoice: z.enum(['default', 'copy-domain'])
    .optional()
    .default('default'),
  copyFromDomain: z.string().optional(),
  userEmail: z.string().email().optional(),
})

export type DeploySubdomainRequest = z.infer<typeof DeploySubdomainSchema>
```

**Impact:**
- Code duplication
- Maintenance burden (must update both)
- Single source of truth violated

**Recommendation:**
- **Keep:** `features/deployment/types/guards.ts` (feature-specific location)
- **Remove:** `types/guards/deploy-subdomain.ts`
- **Update imports** in any API routes using the old location

---

### 2. Duplicate DeployResponse Types

**Location 1:** `features/deployment/types/deploy-subdomain.ts` (lines 13-30)
```typescript
export const DeployResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  domain: z.string().optional(),
  workspace: z.string().optional(),
  port: z.number().optional(),
})

export const DeploySubdomainResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  fullDomain: z.string().optional(),
  workspace: z.string().optional(),
  port: z.number().optional(),
})

export type DeployResponse = z.infer<typeof DeployResponseSchema>
export type DeploySubdomainResponse = z.infer<typeof DeploySubdomainResponseSchema>

export function isDeployResponse(obj: unknown): obj is DeployResponse {
  return DeployResponseSchema.safeParse(obj).success
}

export function isDeploySubdomainResponse(obj: unknown): obj is DeploySubdomainResponse {
  return DeploySubdomainResponseSchema.safeParse(obj).success
}
```

**Location 2:** `app/api/deploy/route.ts` (lines 16-22)
```typescript
interface DeployResponse {
  success: boolean
  message: string
  domain?: string
  workspace?: string
  port?: number
}
```

**Location 3:** `app/api/deploy-subdomain/route.ts` (lines 30-38)
```typescript
interface DeploySubdomainResponse {
  success: boolean
  message: string
  fullDomain?: string
  workspace?: string
  port?: number
}
```

**Impact:**
- Same types defined 3 times
- Inconsistency risk (one might change without others)
- Hard to maintain

**Recommendation:**
- **Keep:** `features/deployment/types/deploy-subdomain.ts` (has Zod schemas + type guards)
- **Remove:** Inline interfaces in API routes
- **Update API routes** to import from features/deployment

---

## Unused Exports & Functions

### 3. Unused Type Guard Functions

**File:** `features/deployment/types/deploy-subdomain.ts`

#### isDeployResponse() - Line 33-35
```typescript
export function isDeployResponse(obj: unknown): obj is DeployResponse {
  return DeployResponseSchema.safeParse(obj).success
}
```

**Status:** ❌ NEVER USED
**Evidence:** No imports or calls found in codebase
**Safe to remove:** YES

#### isDeploySubdomainResponse() - Line 37-39
```typescript
export function isDeploySubdomainResponse(obj: unknown): obj is DeploySubdomainResponse {
  return DeploySubdomainResponseSchema.safeParse(obj).success
}
```

**Status:** ❌ NEVER USED
**Evidence:** No imports or calls found in codebase
**Safe to remove:** YES

---

### 4. Unused Feedback Functions

**File:** `lib/feedback.ts`

#### getFeedbackByWorkspace() - Lines 91-94
```typescript
export async function getFeedbackByWorkspace(
  workspace: string
): Promise<Feedback[]> {
  // Implementation...
}
```

**Status:** ❌ NEVER USED
**Evidence:** Not imported anywhere in codebase
**Safe to remove:** YES

#### updateFeedbackStatus() - Lines 102-113
```typescript
export async function updateFeedbackStatus(
  feedbackId: string,
  status: 'pending' | 'reviewed' | 'implemented'
): Promise<void> {
  // Implementation...
}
```

**Status:** ❌ NEVER USED
**Evidence:** Not imported anywhere in codebase
**Safe to remove:** YES

---

### 5. Unused Markdown Utility Functions

**File:** `lib/utils/markdown-utils.ts`

Only `hasMarkdown()` and `hasCodeBlock()` are actually used. The following are dead code:

#### isPrimaryCodeBlock() - Lines 41-49
```typescript
export function isPrimaryCodeBlock(text: string): boolean {
  const codeBlockMatch = text.match(/```[\s\S]*?```/)
  if (!codeBlockMatch) return false
  const beforeBlock = text.substring(0, codeBlockMatch.index || 0).trim()
  return beforeBlock.length < 50
}
```

**Status:** ❌ NEVER USED
**Safe to remove:** YES

#### hasInlineCode() - Lines 62-64
```typescript
export function hasInlineCode(text: string): boolean {
  return /`[^`]+`/.test(text) && !hasCodeBlock(text)
}
```

**Status:** ❌ NEVER USED
**Safe to remove:** YES

#### getMarkdownComplexity() - Lines 69-82
```typescript
export function getMarkdownComplexity(text: string): 'simple' | 'complex' {
  const hasMultipleBlocks = (text.match(/```/g) || []).length > 2
  const hasHeadings = /^#{1,6} /m.test(text)
  const hasLists = /^[-*+] /m.test(text)
  const hasLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(text)

  if (hasMultipleBlocks || (hasHeadings && hasLists) || hasLinks) {
    return 'complex'
  }
  return 'simple'
}
```

**Status:** ❌ NEVER USED
**Safe to remove:** YES

#### extractCodeLanguage() - Lines 54-57
```typescript
export function extractCodeLanguage(text: string): string | null {
  const match = text.match(/```(\w+)/)
  return match ? match[1] : null
}
```

**Status:** ❌ NEVER USED
**Safe to remove:** YES

---

### 6. Unused Hook

**File:** `lib/hooks/useOnlineStatus.ts`

```typescript
export function useOnlineStatus() {
  // Hook implementation...
}
```

**Status:** ❌ NEVER USED
**Evidence:** Never imported in any component
**Safe to remove:** YES (can remove entire file)

---

### 7. Unused Middleware Function

**File:** `lib/middleware/auth.ts`

```typescript
export async function checkAuth(): Promise<AuthResult> {
  // Lines 20-43
  // Implementation...
}
```

**Status:** ❌ NEVER USED
**Evidence:** Never imported anywhere
**Note:** Similar pattern exists in `deployment/hooks/useAuth.ts`
**Safe to remove:** YES (can remove entire file)

---

## Potentially Dead API Routes

### 8. Test/Debug Routes (Should Be Removed)

#### /api/test-safety
**File:** `app/api/test-safety/route.ts`
**Purpose:** Test endpoint for Groq safety filter
**Status:** ⚠️ Debug route exposed in production
**Recommendation:** Remove or restrict to admin-only access

#### /test-checks
**File:** `app/test-checks/page.tsx`
**Purpose:** Test UI page for safety checker
**Status:** ⚠️ Debug page exposed in production
**Recommendation:** Remove or restrict to admin-only access

---

### 9. Minimal/Low-Value Routes

#### /api/user
**File:** `app/api/user/route.ts`
**Purpose:** Returns session user
**Status:** Minimal endpoint
**Recommendation:** Verify if actively used, consider removing if redundant

#### /api/tokens
**File:** `app/api/tokens/route.ts`
**Purpose:** Returns workspace tokens/credits
**Status:** Appears functional
**Recommendation:** Verify usage before removal

---

## Unused or Duplicate Types

### 10. Rarely Used Type

**File:** `features/deployment/types/deploy-subdomain.ts`
**Type:** `DeploySubdomainForm` (lines 4-10)

```typescript
export interface DeploySubdomainForm {
  domain: string
  subdomain: string
  templateChoice?: 'default' | 'copy-domain'
  copyFromDomain?: string
  userEmail?: string
}
```

**Status:** Only used in `SubdomainDeployForm.tsx`
**Recommendation:** Could be inlined or kept as is (low priority)

---

### 11. Duplicate Type Definition

**File 1:** `types/domain.ts` (line 58)
```typescript
export type DomainPasswords = Record<string, DomainConfig>
```

**File 2:** `app/manager/page.tsx`
```typescript
type DomainPasswords = Record<string, DomainConfig>
```

**Status:** Type defined twice
**Recommendation:** Remove inline definition in manager page, import from types/domain.ts

---

## Minor Issues

### 12. TODO Comments (Incomplete Features)

#### Error Tracking Not Implemented
**File:** `app/error.tsx`
```typescript
// TODO: Send to error tracking service (Sentry)
```

**Status:** Feature not implemented
**Action:** Implement or remove TODO

#### Timestamp Not Accurate
**File:** `app/api/images/list/route.ts`
```typescript
// TODO: get actual timestamp
```

**Status:** Uses current time instead of upload timestamp
**Action:** Fix or document limitation

---

## Summary Table

| Item | Type | File | Lines | Status | Priority |
|------|------|------|-------|--------|----------|
| DeploySubdomainSchema | Duplicate | deploy-subdomain.ts | 7-21 | Remove | HIGH |
| DeployResponse Types | Duplicate (3x) | Multiple files | Various | Consolidate | HIGH |
| isDeployResponse() | Unused Export | deploy-subdomain.ts | 33-35 | Remove | HIGH |
| isDeploySubdomainResponse() | Unused Export | deploy-subdomain.ts | 37-39 | Remove | HIGH |
| getFeedbackByWorkspace() | Unused Export | feedback.ts | 91-94 | Remove | MEDIUM |
| updateFeedbackStatus() | Unused Export | feedback.ts | 102-113 | Remove | MEDIUM |
| isPrimaryCodeBlock() | Unused Export | markdown-utils.ts | 41-49 | Remove | MEDIUM |
| hasInlineCode() | Unused Export | markdown-utils.ts | 62-64 | Remove | MEDIUM |
| getMarkdownComplexity() | Unused Export | markdown-utils.ts | 69-82 | Remove | MEDIUM |
| extractCodeLanguage() | Unused Export | markdown-utils.ts | 54-57 | Remove | MEDIUM |
| useOnlineStatus() | Unused Hook | useOnlineStatus.ts | 5 | Remove file | MEDIUM |
| checkAuth() | Unused Function | middleware/auth.ts | 20-43 | Remove file | MEDIUM |
| /api/test-safety | Debug Route | test-safety/route.ts | - | Remove | LOW |
| /test-checks | Debug Page | test-checks/page.tsx | - | Remove | LOW |

---

## Removal Commands

```bash
# Remove entire files
rm apps/web/lib/hooks/useOnlineStatus.ts
rm apps/web/lib/middleware/auth.ts
rm apps/web/app/api/test-safety/route.ts
rm apps/web/app/test-checks/page.tsx
rm apps/web/types/guards/deploy-subdomain.ts

# Edit these files to remove specific exports
# apps/web/features/deployment/types/deploy-subdomain.ts
#   - Remove isDeployResponse() (lines 33-35)
#   - Remove isDeploySubdomainResponse() (lines 37-39)

# apps/web/lib/feedback.ts
#   - Remove getFeedbackByWorkspace() (lines 91-94)
#   - Remove updateFeedbackStatus() (lines 102-113)

# apps/web/lib/utils/markdown-utils.ts
#   - Remove isPrimaryCodeBlock() (lines 41-49)
#   - Remove hasInlineCode() (lines 62-64)
#   - Remove getMarkdownComplexity() (lines 69-82)
#   - Remove extractCodeLanguage() (lines 54-57)
```

---

## Verification

Before removing, verify with grep:

```bash
cd /root/webalive/claude-bridge/apps/web

# Check each function for usage
grep -r "isDeployResponse" .
grep -r "getFeedbackByWorkspace" .
grep -r "isPrimaryCodeBlock" .
grep -r "useOnlineStatus" .
grep -r "checkAuth" .
```
