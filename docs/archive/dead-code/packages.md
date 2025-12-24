# Dead Code Analysis: packages/

**Scope:** `/root/webalive/claude-bridge/packages/`
**Date:** 2025-11-20

## Critical Findings

### 1. Duplicate Function Implementation - isPortListening()

**Location 1 (UNUSED):** `packages/deploy-scripts/src/orchestration/utils.ts`
**Lines:** 13-33

```typescript
export async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true) // Port is in use
        } else {
          resolve(false)
        }
      })
      .once('listening', () => {
        tester.close()
        resolve(false) // Port is available
      })
      .listen(port, '127.0.0.1')
  })
}
```

**Location 2 (USED):** `packages/deploy-scripts/src/ports/registry.ts`
**Lines:** 75-91

```typescript
export async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true)
        } else {
          resolve(false)
        }
      })
      .once('listening', () => {
        tester.close()
        resolve(false)
      })
      .listen(port, '127.0.0.1')
  })
}
```

**Evidence:**
- `orchestration/utils.ts` version is exported via `orchestration/index.ts:5`
- `ports/registry.ts` version is exported via `ports/index.ts:5`
- Only `ports/registry.ts` version is actually called in the codebase
- Called by `getNextAvailablePort()` at `ports/registry.ts:66`

**Status:** ❌ DUPLICATE - orchestration/utils.ts version is UNUSED

**Dependencies:**
- `net` (Node.js built-in module) - Both versions use it

**Recommendation:**
- **Keep:** `packages/deploy-scripts/src/ports/registry.ts` version
- **Remove:** `packages/deploy-scripts/src/orchestration/utils.ts` version (lines 13-33)
- **Update:** `orchestration/index.ts` to remove the export

**Files to modify:**
```bash
# Remove isPortListening from orchestration/utils.ts (lines 13-33)
# OR remove entire file if only contains this function + delay()
packages/deploy-scripts/src/orchestration/utils.ts

# Remove export from orchestration barrel
packages/deploy-scripts/src/orchestration/index.ts
```

---

### 2. Completely Unused Utility Function - askAI()

**File:** `packages/tools/src/lib/ask-ai.ts`
**Lines:** 3-29

```typescript
export async function askAI(prompt: string, schema?: string): Promise<string> {
  const groq = getGroqClient()

  const systemPrompt = schema
    ? `You are a helpful assistant. Respond in JSON format matching this schema: ${schema}`
    : 'You are a helpful assistant.'

  try {
    const response = await withRetry(async () => {
      return await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    return response.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Error calling AI:', error)
    throw error
  }
}
```

**Status:** ❌ COMPLETELY UNUSED

**Evidence:**
- Not exported from main `packages/tools/src/index.ts`
- Never imported by any tool or test file
- Grep search found 0 usages outside definition file

**Dependencies:**
- `groq-client` (getGroqClient, withRetry) - withRetry is used by generate-persona.ts, so stays in use
- Only the askAI() file itself is dead

**Related Code:**
- Imports `withRetry()` from groq-client
- `withRetry()` IS used in `generate-persona.ts`, so groq-client is not fully dead
- Only `askAI()` itself is orphaned

**Recommendation:**
- **Remove:** `packages/tools/src/lib/ask-ai.ts` entirely
- **Keep:** `lib/groq-client.ts` (used by generate-persona.ts)

**Verification:**
```bash
# Check for any usage
grep -r "askAI" packages/ --exclude-dir=node_modules
# Should only find definition, no imports
```

---

### 3. Unused Configuration Utility - getScriptDir()

**File:** `packages/site-controller/src/config.ts`
**Lines:** 70-72

```typescript
export function getScriptDir(): string {
  return resolve(__dirname, '../scripts')
}
```

**Status:** ❌ NEVER CALLED

**Evidence:**
- Exported from config.ts
- Never imported by orchestrator.ts or any other file
- Grep search found 0 usages in codebase

**Dependencies:**
- `path` (Node.js built-in module, resolve function)

**Recommendation:**
- **Remove:** Function from config.ts (lines 70-72)

**Verification:**
```bash
grep -r "getScriptDir" packages/ --exclude-dir=node_modules
# Should only find definition
```

---

## Secondary Findings (Edge Cases)

### 4. Exported But Not in Public API

**File:** `packages/deploy-scripts/src/orchestration/index.ts`

**Exports:** `delay()` and `isPortListening()`

```typescript
export { delay, isPortListening } from './utils'
```

**Status:** ⚠️ Exported from orchestration but NOT from main package index

**Evidence:**
- `packages/deploy-scripts/src/index.ts` does NOT export these
- Only exports: `deploySite`, `backupWebsites`, `DeploymentError`
- No external usage found in apps/ or other packages

**Recommendation:**
- **Low priority** - These are internal utilities
- Consider removing from orchestration/index.ts if truly internal
- Or document as internal-only exports

---

## Confirmed Working Exports

The following were initially suspected but are **CONFIRMED IN USE:**

### ✅ Caddy Functions (USED)
**File:** `packages/deploy-scripts/src/caddy/config.ts`

- `updateCaddyfile()` - Called in `orchestration/deploy.ts:87`
- `createSiteCaddyfile()` - Called in `orchestration/deploy.ts:183`

**Status:** ✅ ACTIVELY USED

---

### ✅ Workspace Tools (USED)
**File:** `packages/tools/src/lib/env-sanitizer.ts`

- `sanitizeSubprocessEnv()` - Used in workspace tools

**Status:** ✅ ACTIVELY USED

---

### ✅ Workspace Validators (USED)
**File:** `packages/tools/src/lib/workspace-validator.ts`

- `validateWorkspacePath()` - Used in check-codebase tool
- `hasPackageJson()` - Used in install-package tool

**Status:** ✅ ACTIVELY USED

---

### ✅ Bridge API Client (USED)
**File:** `packages/tools/src/lib/bridge-api-client.ts`

- `successResult()` - Used in workspace tools
- `errorResult()` - Used in workspace tools

**Status:** ✅ ACTIVELY USED

---

### ✅ Images Package (USED)
**File:** `packages/images/src/core/keys.ts`

- `generateStorageKey()` - Exported from images index
- `parseStorageKey()` - Exported from images index

**Status:** ✅ ACTIVELY USED

All images package exports are tested and imported by apps/web.

---

## Summary Table

| Dead Code | Type | File | Lines | Impact | Action |
|-----------|------|------|-------|--------|--------|
| isPortListening() | Duplicate Function | orchestration/utils.ts | 13-33 | HIGH | Remove duplicate, keep registry.ts version |
| askAI() | Unused Function | tools/src/lib/ask-ai.ts | 3-29 | MEDIUM | Remove entire file |
| getScriptDir() | Unused Function | site-controller/src/config.ts | 70-72 | LOW | Remove function |
| delay(), isPortListening() | Edge Export | orchestration/index.ts | - | LOW | Review internal API |

---

## Recommendations

### Priority 1: Remove Duplicate (High Impact)

**Action:** Consolidate isPortListening()

```bash
# 1. Remove duplicate implementation
# Edit packages/deploy-scripts/src/orchestration/utils.ts
# Delete lines 13-33 (isPortListening function)

# 2. Update orchestration barrel
# Edit packages/deploy-scripts/src/orchestration/index.ts
# Remove isPortListening from export

# 3. Verify registry.ts version is working
# This is the version actually used
```

**Verification:**
```typescript
// After removal, verify this still works:
import { getNextAvailablePort } from '@/packages/deploy-scripts/src/ports'
// Should use isPortListening from ports/registry.ts
```

---

### Priority 2: Remove Unused askAI (Medium Impact)

**Action:** Remove orphaned AI utility

```bash
# Remove entire file
rm packages/tools/src/lib/ask-ai.ts
```

**Verification:**
```bash
# Check nothing broke
bun run test packages/tools
```

---

### Priority 3: Remove getScriptDir (Low Impact)

**Action:** Remove unused config helper

```bash
# Edit packages/site-controller/src/config.ts
# Delete lines 70-72 (getScriptDir function)
```

---

## Verification Commands

```bash
# Check for usage of dead code
cd /root/webalive/claude-bridge

# Check isPortListening usage
grep -r "isPortListening" packages/ --exclude-dir=node_modules

# Check askAI usage
grep -r "askAI" packages/ --exclude-dir=node_modules

# Check getScriptDir usage
grep -r "getScriptDir" packages/ --exclude-dir=node_modules

# Run tests after cleanup
bun run test
```

---

## Impact Analysis

### Removing isPortListening Duplicate

**Benefits:**
- Eliminates code duplication (18 lines)
- Single source of truth for port checking
- Clearer codebase organization

**Risks:**
- None - orchestration/utils.ts version is never called

---

### Removing askAI()

**Benefits:**
- Removes 27 lines of dead code
- Eliminates unused Groq AI integration point
- Reduces maintenance burden

**Risks:**
- None - function never imported anywhere
- groq-client.ts still works for generate-persona.ts

---

### Removing getScriptDir()

**Benefits:**
- Removes 3 lines of dead code
- Cleaner config.ts exports

**Risks:**
- None - function never called

---

## Related Files

**Files that will be modified:**
1. `packages/deploy-scripts/src/orchestration/utils.ts` - Remove duplicate isPortListening
2. `packages/deploy-scripts/src/orchestration/index.ts` - Remove export
3. `packages/tools/src/lib/ask-ai.ts` - Delete entire file
4. `packages/site-controller/src/config.ts` - Remove getScriptDir function

**Files that will NOT be modified:**
- `packages/deploy-scripts/src/ports/registry.ts` - Keep working isPortListening
- `packages/tools/src/lib/groq-client.ts` - Keep for generate-persona.ts
- All other confirmed working exports
