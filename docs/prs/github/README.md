# GitHub Integration - Phased Implementation

**Goal:** Enable users to work on multiple PRs in parallel via a "Draft" abstraction.

**Constraint:** Each phase must be independently testable by both AI (API/unit tests) and humans (visual/UX).

---

## Phase Overview

| Phase | Name | AI Test | Human Test | Time |
|-------|------|---------|------------|------|
| **1** | [Feature Flag + Types](./phase-01-feature-flag.md) | Unit test `isGitHubEnabled()` | N/A | 0.5h |
| **2** | [Connect Button UI](./phase-02-connect-button.md) | Component renders | See button in Settings | 2h |
| **3** | [Draft Indicator UI](./phase-03-draft-indicator.md) | Component renders | See indicator in header | 3h |
| **4** | [Draft Panel UI](./phase-04-draft-panel.md) | Component renders | Click indicator, see panel | 3h |
| **5** | [GitHub OAuth Flow](./phase-05-github-oauth.md) | API returns 302 redirect | Complete OAuth in browser | 4h |
| **6** | [Repo Creation](./phase-06-repo-creation.md) | API creates repo | See repo on GitHub | 3h |
| **7** | [Git Status Detection](./phase-07-git-status.md) | API returns dirty/clean | Edit file, see status change | 3h |
| **8** | [Branch Operations](./phase-08-branch-ops.md) | API creates/switches branch | Create draft, see branch | 4h |
| **9** | [PR Submission](./phase-09-pr-submission.md) | API creates PR | Submit draft, see PR on GitHub | 3h |
| **10** | [Conflict Resolution](./phase-10-conflicts.md) | API detects conflicts | See conflict UI, resolve | 4h |

**Total:** ~30 hours (~4 days)

---

## Testing Philosophy

Every phase has two types of tests:

### AI Tests (Automated)
- Unit tests that can run in CI
- API endpoint tests with curl/fetch
- Component render tests

### Human Tests (Manual)
- Visual verification in browser
- UX flow walkthrough
- Edge case exploration

**Rule:** A phase is not complete until both test types pass.

---

## Feature Flag

GitHub integration is restricted during development to **admin sites AND admin users**:

```typescript
// apps/web/lib/github/feature-flag.ts
const ADMIN_SITES = ['huurmatcher.alive.best'] as const;
const ADMIN_USERS = ['admin@example.com'] as const;

// Site-only check (for early client-side bailout)
export function isGitHubEnabledForSite(workspace: string): boolean {
  return ADMIN_SITES.includes(workspace as typeof ADMIN_SITES[number]);
}

// User check
export function isGitHubAdmin(userEmail: string): boolean {
  return ADMIN_USERS.includes(userEmail as typeof ADMIN_USERS[number]);
}

// Full check: BOTH must pass
export function isGitHubEnabled(workspace: string, userEmail?: string): boolean {
  if (!isGitHubEnabledForSite(workspace)) return false;
  if (!userEmail) return false;
  return isGitHubAdmin(userEmail);
}
```

**Usage in components:**
```typescript
const { data: user } = useUser();
if (!isGitHubEnabled(workspace, user?.email)) return null;
```

**Usage in API routes:**
```typescript
const user = await getUser(req);
if (!isGitHubEnabled(workspace, user?.email)) {
  return Response.json({ error: 'GitHub not available' }, { status: 403 });
}
```

---

## Key Concepts

### Draft = Branch + PR (Hidden)

| User Sees | Git Reality |
|-----------|-------------|
| "Add contact form" | `draft-abc123` branch |
| "Submit for Review" | Create PR |
| "3 behind" | 3 commits behind main |
| "Keep my version" | `git checkout --ours` |

### Conflict Resolution = Binary Choice

Per-file: "Keep my version" or "Use live version". No merge markers.

---

## Database Tables

```sql
app.workspace_git_config
  - workspace_domain (PK)
  - github_installation_id, github_user_id, github_username
  - repo_owner, repo_name
  - active_draft_id
  - last_synced_at, last_synced_commit

app.workspace_drafts
  - id (PK), workspace_domain (FK)
  - name, status, branch_name, base_branch
  - pr_number, pr_url, pr_state
  - created_by, created_at
```

---

## API Routes by Phase

| Phase | Routes |
|-------|--------|
| 5 | `GET /api/auth/github/install`, `GET /api/auth/github/callback` |
| 5 | `GET /api/git/status` (connection only), `DELETE /api/git/connection` |
| 6 | Callback creates repo |
| 7 | `GET /api/git/status` (real dirty/clean), `POST /api/git/sync` |
| 8 | `POST /api/git/drafts`, `POST /api/git/drafts/[id]/switch`, `POST /api/git/drafts/main` |
| 9 | `POST /api/git/drafts/[id]/submit`, `DELETE /api/git/drafts/[id]` |
| 10 | `POST /api/git/drafts/[id]/update`, `POST /api/git/drafts/[id]/resolve` |

---

## Prerequisites (Before Phase 5)

1. Create GitHub App at github.com/settings/apps
2. Set environment variables:
   ```
   GITHUB_APP_ID, GITHUB_APP_SLUG
   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
   GITHUB_PRIVATE_KEY
   ```
3. Run database migrations (see below)
4. Add `/public/integrations/github.svg`
5. Add `getUserEmail` helper function (see below)

---

## Helper Functions

### getUserEmail

This function retrieves the user's email from their userId. Add to `apps/web/lib/auth.ts`:

```typescript
// apps/web/lib/auth.ts (add to existing)
import { supabaseAdmin } from '@/lib/supabase';

export async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  return data?.email ?? null;
}
```

---

## Database Migrations (Ordered)

Run these migrations in order:

### Migration 1: workspace_git_config (Phase 5)
```sql
-- supabase/migrations/001_workspace_git_config.sql
CREATE TABLE IF NOT EXISTS app.workspace_git_config (
  workspace_domain TEXT PRIMARY KEY,
  github_installation_id BIGINT NOT NULL,
  github_user_id BIGINT NOT NULL,
  github_username TEXT NOT NULL,
  repo_owner TEXT,
  repo_name TEXT,
  active_draft_id UUID,
  last_synced_at TIMESTAMPTZ,
  last_synced_commit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Migration 2: workspace_drafts (Phase 8)
```sql
-- supabase/migrations/002_workspace_drafts.sql
CREATE TABLE IF NOT EXISTS app.workspace_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_domain TEXT NOT NULL REFERENCES app.workspace_git_config(workspace_domain) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'editing' CHECK (status IN ('editing', 'submitted', 'merged', 'closed')),
  branch_name TEXT NOT NULL,
  base_branch TEXT NOT NULL DEFAULT 'main',
  pr_number INTEGER,
  pr_url TEXT,
  pr_state TEXT CHECK (pr_state IN ('open', 'merged', 'closed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_domain, branch_name)
);

CREATE INDEX idx_drafts_workspace ON app.workspace_drafts(workspace_domain);

-- Add FK for active_draft_id (must come after workspace_drafts exists)
ALTER TABLE app.workspace_git_config
  ADD CONSTRAINT fk_active_draft
  FOREIGN KEY (active_draft_id) REFERENCES app.workspace_drafts(id) ON DELETE SET NULL;
```

---

## Dependencies

```bash
bun add @octokit/app @octokit/rest nanoid swr
```

---

## Error Handling

All API routes follow this pattern:

```typescript
try {
  // ... operation
} catch (error) {
  console.error('Operation failed:', error);
  return NextResponse.json({
    error: error instanceof Error ? error.message : 'Unknown error'
  }, { status: 500 });
}
```

For git operations that might fail silently (like "no changes to commit"), wrap in try-catch and continue:

```typescript
try {
  await commitAndPush(workspace, message, token);
} catch {
  // No changes to commit - that's fine
}
```

---

## Mock to Real API Transition

The `apps/web/lib/github/api.ts` file provides a single interface that switches between mock and real implementations:

```typescript
// Phase 1-4: All mocked
export const gitApi = mockGitApi;

// Phase 5: connect/disconnect/getStatus are real
export const gitApi = USE_MOCK ? mockGitApi : realGitApi;

// Phase 9: All real except updateDraft/resolveConflicts
const realGitApi = {
  // ... real implementations
  updateDraft: mockGitApi.updateDraft,  // Still mocked
  resolveConflicts: mockGitApi.resolveConflicts,  // Still mocked
};

// Phase 10: Everything real
export const gitApi = realGitApi;
```

Components use `gitApi` and don't need to change as implementations become real.
