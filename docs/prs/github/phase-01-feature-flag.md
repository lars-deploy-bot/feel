# Phase 1: Feature Flag + Types

**Time:** 0.5 hours
**Depends on:** Nothing
**Deliverable:** Feature flag function and TypeScript types

---

## Goal

Create the foundation: feature flag to restrict GitHub UI to **admin sites AND admin users**, and shared TypeScript types for the entire feature.

**Two checks required:**
1. Workspace must be in ADMIN_SITES list
2. User must be in ADMIN_USERS list (by email)

---

## Files to Create

### 1. Feature Flag

```typescript
// apps/web/lib/github/feature-flag.ts

const ADMIN_SITES = ['huurmatcher.alive.best'] as const;

const ADMIN_USERS = ['eedenlars@gmail.com'] as const;

/**
 * Check if GitHub UI should be shown for this workspace.
 * Used for client-side rendering decisions.
 */
export function isGitHubEnabledForSite(workspace: string): boolean {
  return ADMIN_SITES.includes(workspace as typeof ADMIN_SITES[number]);
}

/**
 * Check if user is an admin who can use GitHub features.
 */
export function isGitHubAdmin(userEmail: string): boolean {
  return ADMIN_USERS.includes(userEmail as typeof ADMIN_USERS[number]);
}

/**
 * Full check: both site AND user must be admin.
 * Use this in API routes and components.
 */
export function isGitHubEnabled(workspace: string, userEmail?: string): boolean {
  if (!isGitHubEnabledForSite(workspace)) return false;
  if (!userEmail) return false;
  return isGitHubAdmin(userEmail);
}
```

### 2. Types

```typescript
// apps/web/lib/github/types.ts
export interface GitHubConnection {
  connected: boolean;
  username?: string;
  repo?: {
    owner: string;
    name: string;
    url: string;
  };
}

export interface GitStatus {
  enabled: boolean;
  connected: boolean;
  username?: string;
  repo?: { owner: string; name: string; url: string };
  onMain: boolean;
  isDirty: boolean;
  changedFiles: number;
  activeDraft?: Draft;
  behindMain: number;
}

export interface Draft {
  id: string;
  name: string;
  status: 'editing' | 'submitted' | 'merged' | 'closed';
  branch: string;
  prNumber?: number;
  prUrl?: string;
  prState?: 'open' | 'merged' | 'closed';
  isActive: boolean;
  behindBy: number;
  hasConflicts: boolean;
  conflictingFiles: string[];
  createdAt: string;
}

export interface ConflictResolution {
  file: string;
  choice: 'mine' | 'theirs';
}
```

---

## AI Tests

```typescript
// apps/web/lib/github/__tests__/feature-flag.test.ts
import { describe, it, expect } from 'vitest';
import { isGitHubEnabled, isGitHubEnabledForSite, isGitHubAdmin } from '../feature-flag';

describe('isGitHubEnabledForSite', () => {
  it('returns true for admin site', () => {
    expect(isGitHubEnabledForSite('huurmatcher.alive.best')).toBe(true);
  });

  it('returns false for non-admin site', () => {
    expect(isGitHubEnabledForSite('random.alive.best')).toBe(false);
  });
});

describe('isGitHubAdmin', () => {
  it('returns true for admin user', () => {
    expect(isGitHubAdmin('eedenlars@gmail.com')).toBe(true);
  });

  it('returns false for non-admin user', () => {
    expect(isGitHubAdmin('random@example.com')).toBe(false);
  });
});

describe('isGitHubEnabled', () => {
  it('returns true for admin site + admin user', () => {
    expect(isGitHubEnabled('huurmatcher.alive.best', 'eedenlars@gmail.com')).toBe(true);
  });

  it('returns false for admin site + non-admin user', () => {
    expect(isGitHubEnabled('huurmatcher.alive.best', 'random@example.com')).toBe(false);
  });

  it('returns false for non-admin site + admin user', () => {
    expect(isGitHubEnabled('random.alive.best', 'eedenlars@gmail.com')).toBe(false);
  });

  it('returns false for non-admin site + non-admin user', () => {
    expect(isGitHubEnabled('random.alive.best', 'random@example.com')).toBe(false);
  });

  it('returns false when no user email provided', () => {
    expect(isGitHubEnabled('huurmatcher.alive.best')).toBe(false);
    expect(isGitHubEnabled('huurmatcher.alive.best', undefined)).toBe(false);
  });
});
```

**Run:** `bun test apps/web/lib/github/__tests__/feature-flag.test.ts`

---

## Human Tests

None required - this is pure logic with no UI.

---

## Definition of Done

- [ ] `feature-flag.ts` exists
- [ ] `types.ts` exists
- [ ] Unit tests pass
- [ ] TypeScript compiles without errors
