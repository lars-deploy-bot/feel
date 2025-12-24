# File Operations Duplicate Code Analysis

## Executive Summary

**Total Estimated Duplicate Lines:** 200-260 lines
**Files Affected:** 10-15 files
**Priority Level:** HIGH - Security and consistency critical

---

## High Priority Duplications

### 1. Path Resolution & Validation Pattern
**Impact:** 3 files, ~30-40 lines
**Priority:** CRITICAL - Security boundary

**Files:**
- `apps/web/app/api/files/route.ts` (lines 46-68)
- `apps/web/features/workspace/lib/workspace-secure.ts` (lines 37-48, 107-112)
- `apps/web/features/chat/lib/workspaceRetriever.ts` (lines 88-105)

**Pattern:**
```typescript
const fullPath = path.join(workspacePath, targetPath)
const resolvedPath = path.resolve(fullPath)
const resolvedWorkspace = path.resolve(workspacePath)
if (!isPathWithinWorkspace(resolvedPath, resolvedWorkspace, path.sep)) {
  throw new Error('Path outside workspace')
}
```

**Solution:**
```typescript
// lib/utils/path-security.ts
export function resolveAndValidatePath(
  targetPath: string,
  workspaceRoot: string
): { valid: boolean; resolvedPath: string; error?: string } {
  const fullPath = path.join(workspaceRoot, targetPath)
  const resolvedPath = path.resolve(fullPath)
  const resolvedWorkspace = path.resolve(workspaceRoot)

  if (!isPathWithinWorkspace(resolvedPath, resolvedWorkspace, path.sep)) {
    return {
      valid: false,
      resolvedPath,
      error: 'Path outside workspace'
    }
  }

  return { valid: true, resolvedPath }
}
```

---

### 2. Directory Existence Check + Recursive Creation
**Impact:** 6+ files, ~60-70 lines
**Priority:** HIGH

**Files:**
- `packages/deploy-scripts/src/files/directory.ts` (lines 11-17)
- `apps/web/lib/siteMetadataStore.ts` (lines 58-65)
- `apps/web/lib/input-logger.ts` (line 25)
- `apps/web/app/api/webhook/deploy/route.ts` (lines 15-18)
- `packages/images/src/storage/filesystem.ts` (line 32)
- `apps/web/scripts/run-agent.mjs` (line 48)

**Pattern:**
```typescript
try {
  await fs.mkdir(dir, { recursive: true })
} catch (mkdirError) {
  if (!(mkdirError instanceof Error) || !mkdirError.message.includes('EEXIST')) {
    throw mkdirError
  }
}
```

**Solution:**
```typescript
// lib/utils/fs-helpers.ts
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (error instanceof Error && !error.message.includes('EEXIST')) {
      throw error
    }
    // Directory already exists, ignore
  }
}
```

---

### 3. JSON File Read with Error Handling
**Impact:** 3 files, ~50-60 lines
**Priority:** HIGH

**Files:**
- `packages/deploy-scripts/src/ports/registry.ts` (lines 36-47, 52-62, 100-105)
- `apps/web/lib/siteMetadataStore.ts` (lines 29-50, 81-88)
- `packages/deploy-scripts/src/caddy/config.ts` (line 24)

**Pattern:**
```typescript
try {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
} catch (error) {
  if (error instanceof Error && error.message.includes('ENOENT')) {
    return null // or default value
  }
  throw error
}
```

**Solution:**
```typescript
// lib/utils/fs-helpers.ts
export async function readJsonFile<T>(
  filePath: string,
  defaultValue?: T
): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return defaultValue ?? null
    }
    throw error
  }
}
```

---

### 4. JSON File Write with Pretty Print
**Impact:** 3 files, ~15-20 lines
**Priority:** HIGH

**Files:**
- `packages/deploy-scripts/src/ports/registry.ts` (line 112)
- `apps/web/lib/siteMetadataStore.ts` (line 67)
- `apps/web/e2e-tests/genuine-setup.ts` (line 50)

**Pattern:**
```typescript
await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
```

**Solution:**
```typescript
// lib/utils/fs-helpers.ts
export async function writeJsonFile<T>(
  filePath: string,
  data: T,
  options?: { spaces?: number }
): Promise<void> {
  const spaces = options?.spaces ?? 2
  await fs.writeFile(filePath, JSON.stringify(data, null, spaces), 'utf-8')
}
```

---

### 5. Directory Listing + Stat
**Impact:** 2 files, ~30-35 lines
**Priority:** HIGH

**Files:**
- `apps/web/app/api/files/route.ts` (lines 71-85)
- `packages/images/src/storage/filesystem.ts` (lines 150-162)

**Pattern:**
```typescript
const entries = await readdir(fullPath, { withFileTypes: true })
const files: FileInfo[] = []

for (const entry of entries) {
  const entryPath = path.join(fullPath, entry.name)
  const stats = await stat(entryPath)

  files.push({
    name: entry.name,
    type: entry.isDirectory() ? 'directory' : 'file',
    size: stats.size,
    modified: stats.mtime.toISOString()
  })
}
```

**Solution:**
```typescript
// lib/utils/fs-helpers.ts
export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
  path: string
}

export async function listDirectoryWithStats(
  dirPath: string,
  options?: { relativeTo?: string }
): Promise<FileEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files: FileEntry[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const stats = await fs.stat(fullPath)

    files.push({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
      path: options?.relativeTo
        ? path.relative(options.relativeTo, fullPath)
        : fullPath
    })
  }

  return files
}
```

---

## Medium Priority Duplications

### 6. Path Normalization + Traversal Detection
**Impact:** 2 files, ~15-20 lines
**Priority:** MEDIUM (Security-related)

**Files:**
- `apps/web/features/chat/lib/workspaceRetriever.ts` (lines 88-93)
- `apps/web/features/workspace/lib/workspace-secure.ts` (lines 107-112)

**Pattern:**
```typescript
const normalized = path.normalize(candidatePath)
if (normalized !== candidatePath || normalized.includes('..')) {
  throw new Error('Path traversal detected')
}
```

**Solution:**
```typescript
// lib/utils/path-security.ts
export function detectPathTraversal(inputPath: string): {
  safe: boolean
  normalized: string
  reason?: string
} {
  const normalized = path.normalize(inputPath)

  if (normalized !== inputPath) {
    return {
      safe: false,
      normalized,
      reason: 'Path normalization changed value'
    }
  }

  if (normalized.includes('..')) {
    return {
      safe: false,
      normalized,
      reason: 'Contains parent directory references'
    }
  }

  return { safe: true, normalized }
}
```

---

## Good Patterns (Already Well-Extracted)

### 7. Workspace Ownership Pattern (GOOD!)
**File:** `apps/web/features/workspace/lib/workspace-secure.ts`
**Function:** `writeAsWorkspaceOwner()`

**Why it's good:**
- Complex atomic write logic (~30 lines)
- Properly encapsulated
- Uses temp file + chown + atomic rename
- Single responsibility

**Pattern (for reference):**
```typescript
export async function writeAsWorkspaceOwner(
  filePath: string,
  content: string | Buffer,
  workspace: Workspace
): Promise<void> {
  const dir = path.dirname(filePath)
  const tmp = path.join(dir, `.tmp-${crypto.randomUUID()}`)

  const fd = fs.openSync(
    tmp,
    fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
    0o644
  )

  try {
    fs.writeFileSync(fd, content)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }

  fs.chownSync(tmp, workspace.uid, workspace.gid)
  fs.renameSync(tmp, filePath)

  // fsync directory for durability
  const dirFd = fs.openSync(dir, 'r')
  try {
    fs.fsyncSync(dirFd)
  } finally {
    fs.closeSync(dirFd)
  }
}
```

**Note:** This is a good example of proper abstraction. Do NOT duplicate this pattern.

---

### 8. Recursive Directory Copy (GOOD!)
**File:** `packages/deploy-scripts/src/files/directory.ts`
**Function:** `copyDir()`

**Why it's good:**
- Complex recursive logic (~40 lines)
- Single occurrence (not duplicated)
- Well-tested
- Handles symlinks, files, and directories

**Note:** Already properly extracted. Keep as reusable utility.

---

## Refactoring Action Plan

### Phase 1: Create Core File Helpers (Week 1)
**Priority:** HIGH
**Impact:** ~200 lines saved, improved security

1. **Create `lib/utils/fs-helpers.ts`**
   ```typescript
   export async function ensureDirectory(dirPath: string): Promise<void>
   export async function readJsonFile<T>(filePath: string, defaultValue?: T): Promise<T | null>
   export async function writeJsonFile<T>(filePath: string, data: T, options?: { spaces?: number }): Promise<void>
   export async function listDirectoryWithStats(dirPath: string, options?: { relativeTo?: string }): Promise<FileEntry[]>
   ```

2. **Migrate 10+ files to use new helpers:**
   - `packages/deploy-scripts/src/ports/registry.ts` (3 locations)
   - `apps/web/lib/siteMetadataStore.ts` (2 locations)
   - `apps/web/app/api/files/route.ts`
   - `packages/images/src/storage/filesystem.ts`
   - And 4 more files

---

### Phase 2: Create Security Utilities (Week 1)
**Priority:** CRITICAL
**Impact:** ~50 lines saved, centralized security

3. **Create `lib/utils/path-security.ts`**
   ```typescript
   export function resolveAndValidatePath(
     targetPath: string,
     workspaceRoot: string
   ): { valid: boolean; resolvedPath: string; error?: string }

   export function detectPathTraversal(inputPath: string): {
     safe: boolean
     normalized: string
     reason?: string
   }
   ```

4. **Migrate security-critical files:**
   - `apps/web/app/api/files/route.ts`
   - `apps/web/features/workspace/lib/workspace-secure.ts`
   - `apps/web/features/chat/lib/workspaceRetriever.ts`

---

### Phase 3: Testing & Documentation (Week 2)
**Priority:** HIGH

5. **Write comprehensive tests:**
   - Unit tests for all fs-helpers functions
   - Security tests for path-security functions
   - Edge cases (symlinks, permissions, ENOENT, etc.)

6. **Update documentation:**
   - Add usage examples to each function
   - Document security considerations
   - Create migration guide

---

## New File Structure

```
lib/
└── utils/
    ├── fs-helpers.ts           # NEW - File system utilities
    │   ├── ensureDirectory()
    │   ├── readJsonFile()
    │   ├── writeJsonFile()
    │   └── listDirectoryWithStats()
    │
    └── path-security.ts        # NEW - Path security utilities
        ├── resolveAndValidatePath()
        └── detectPathTraversal()

packages/
├── deploy-scripts/
│   └── src/
│       └── files/
│           └── directory.ts    # Keep - Well-extracted
└── ...
```

---

## Migration Example

**Before:**
```typescript
// apps/web/app/api/files/route.ts
try {
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content)
  return data
} catch (error) {
  if (error instanceof Error && error.message.includes('ENOENT')) {
    return null
  }
  throw error
}
```

**After:**
```typescript
// apps/web/app/api/files/route.ts
import { readJsonFile } from '@/lib/utils/fs-helpers'

const data = await readJsonFile(filePath)
```

---

## Testing Strategy

### For `fs-helpers.ts`:
```typescript
describe('ensureDirectory', () => {
  it('creates directory if missing')
  it('ignores EEXIST errors')
  it('throws on permission errors')
  it('creates nested directories')
})

describe('readJsonFile', () => {
  it('reads and parses JSON')
  it('returns null on ENOENT')
  it('returns default value when provided')
  it('throws on invalid JSON')
  it('throws on permission errors')
})

describe('writeJsonFile', () => {
  it('writes JSON with 2-space indent by default')
  it('respects custom spacing')
  it('creates parent directory if needed')
  it('throws on permission errors')
})

describe('listDirectoryWithStats', () => {
  it('lists files with metadata')
  it('distinguishes files from directories')
  it('computes relative paths when requested')
  it('handles empty directories')
})
```

### For `path-security.ts`:
```typescript
describe('resolveAndValidatePath', () => {
  it('allows paths within workspace')
  it('blocks path traversal with ..')
  it('blocks absolute paths outside workspace')
  it('resolves symlinks correctly')
  it('handles edge cases (., ~, etc.)')
})

describe('detectPathTraversal', () => {
  it('detects .. sequences')
  it('detects normalization changes')
  it('allows safe paths')
})
```

---

## Benefits Summary

### Security
- **Centralized path validation** - Single source of truth for security checks
- **Consistent error handling** - Same behavior across all file operations
- **Easier auditing** - Review one file instead of 10+

### Maintainability
- **DRY principle** - No duplicate file operation code
- **Single responsibility** - Each helper does one thing well
- **Easy to test** - Test helpers once instead of testing inline code everywhere

### Developer Experience
- **Clearer intent** - `readJsonFile()` vs 10 lines of try/catch
- **Less boilerplate** - Import and use instead of reimplementing
- **Type safety** - Generic helpers with proper TypeScript types

---

## Migration Checklist

- [ ] Phase 1: Create core helpers (Week 1)
  - [ ] Create `lib/utils/fs-helpers.ts`
  - [ ] Implement `ensureDirectory()`
  - [ ] Implement `readJsonFile()`
  - [ ] Implement `writeJsonFile()`
  - [ ] Implement `listDirectoryWithStats()`
  - [ ] Write unit tests for all functions

- [ ] Phase 2: Create security utilities (Week 1)
  - [ ] Create `lib/utils/path-security.ts`
  - [ ] Implement `resolveAndValidatePath()`
  - [ ] Implement `detectPathTraversal()`
  - [ ] Write security tests

- [ ] Phase 3: Migration (Week 2)
  - [ ] Migrate `packages/deploy-scripts/src/ports/registry.ts`
  - [ ] Migrate `apps/web/lib/siteMetadataStore.ts`
  - [ ] Migrate `apps/web/app/api/files/route.ts`
  - [ ] Migrate `packages/images/src/storage/filesystem.ts`
  - [ ] Migrate security-critical files (3 files)
  - [ ] Run full test suite
  - [ ] Update documentation

- [ ] Phase 4: Cleanup (Week 2)
  - [ ] Remove old duplicate code
  - [ ] Update contributing guide
  - [ ] Document best practices
