# Phase 10: Conflict Resolution

**Time:** 4 hours
**Depends on:** Phase 9
**Deliverable:** Detect behind-main, resolve conflicts

---

## Goal

Complete the system: detect when draft is behind main, attempt auto-merge, show conflict UI when needed, resolve with binary choices.

**Security:** All API routes require BOTH admin site AND admin user.

---

## Files to Create/Modify

### 1. Conflict Operations

```typescript
// apps/web/lib/github/conflict-ops.ts
import { runAsWorkspaceUser } from '@/lib/workspace-execution/command-runner';
import { getWorkspacePath } from '@/lib/workspace';

async function git(args: string[], workspacePath: string, token?: string): Promise<string> {
  const result = await runAsWorkspaceUser({
    workspacePath,
    command: 'git',
    args,
    env: { GIT_TERMINAL_PROMPT: '0' },
    stdin: token ? `protocol=https\nhost=github.com\nusername=x-access-token\npassword=${token}\n\n` : undefined,
  });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export async function getBehindCount(domain: string, branch: string): Promise<number> {
  const workspacePath = getWorkspacePath(domain);

  // Fetch latest
  await git(['fetch', 'origin', 'main'], workspacePath);

  // Count commits behind
  const result = await git(
    ['rev-list', '--count', `${branch}..origin/main`],
    workspacePath
  );

  return parseInt(result, 10) || 0;
}

export async function attemptMerge(domain: string): Promise<{
  success: boolean;
  conflictingFiles?: string[];
}> {
  const workspacePath = getWorkspacePath(domain);

  try {
    // Try to merge main
    await git(['merge', 'origin/main', '--no-edit'], workspacePath);
    return { success: true };
  } catch (error) {
    // Get conflicting files
    const status = await git(['status', '--porcelain'], workspacePath);
    const conflicts = status
      .split('\n')
      .filter(line => line.startsWith('UU') || line.startsWith('AA'))
      .map(line => line.slice(3).trim());

    return { success: false, conflictingFiles: conflicts };
  }
}

export async function resolveConflict(
  domain: string,
  file: string,
  choice: 'mine' | 'theirs'
): Promise<void> {
  const workspacePath = getWorkspacePath(domain);

  if (choice === 'mine') {
    await git(['checkout', '--ours', file], workspacePath);
  } else {
    await git(['checkout', '--theirs', file], workspacePath);
  }

  await git(['add', file], workspacePath);
}

export async function finalizeMerge(domain: string): Promise<void> {
  const workspacePath = getWorkspacePath(domain);
  await git(['commit', '--no-edit'], workspacePath);
}

export async function abortMerge(domain: string): Promise<void> {
  const workspacePath = getWorkspacePath(domain);
  try {
    await git(['merge', '--abort'], workspacePath);
  } catch {
    // No merge in progress
  }
}
```

### 2. Update Status Route (Include Behind Count)

```typescript
// apps/web/app/api/git/status/route.ts (update)
import { getBehindCount } from '@/lib/github/conflict-ops';
import { getCurrentBranch } from '@/lib/github/git-status';

// In the GET handler, after getting config:
let behindMain = 0;
const currentBranch = await getCurrentBranch(workspace);

if (currentBranch !== 'main') {
  try {
    behindMain = await getBehindCount(workspace, currentBranch);
  } catch {
    // Ignore errors
  }
}

// Include in response:
return NextResponse.json({
  // ... existing fields ...
  behindMain,
});
```

### 3. Update Draft Route

```typescript
// apps/web/app/api/git/drafts/[id]/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { attemptMerge, abortMerge } from '@/lib/github/conflict-ops';
import { switchBranch } from '@/lib/github/branch-ops';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const workspace = req.nextUrl.searchParams.get('workspace');

  const userId = await getCookieUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user email to check admin status
  const userEmail = await getUserEmail(userId);

  // Check BOTH admin site AND admin user
  if (!workspace || !isGitHubEnabled(workspace, userEmail)) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const { data: draft } = await supabaseAdmin
    .from('workspace_drafts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!draft || draft.workspace_domain !== workspace) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Ensure on draft branch
  await switchBranch(workspace, draft.branch_name);

  // Attempt merge
  const result = await attemptMerge(workspace);

  if (result.success) {
    return NextResponse.json({ updated: true, hasConflicts: false });
  }

  return NextResponse.json({
    updated: false,
    hasConflicts: true,
    conflictingFiles: result.conflictingFiles,
  });
}
```

### 4. Resolve Conflicts Route

```typescript
// apps/web/app/api/git/drafts/[id]/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { resolveConflict, finalizeMerge } from '@/lib/github/conflict-ops';
import { pushBranch, switchBranch } from '@/lib/github/branch-ops';
import { getGitHubToken } from '@/lib/github/token-storage';
import type { ConflictResolution } from '@/lib/github/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const workspace = req.nextUrl.searchParams.get('workspace');
  const { resolutions } = await req.json() as { resolutions: ConflictResolution[] };

  const userId = await getCookieUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user email to check admin status
  const userEmail = await getUserEmail(userId);

  // Check BOTH admin site AND admin user
  if (!workspace || !isGitHubEnabled(workspace, userEmail)) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const { data: draft } = await supabaseAdmin
    .from('workspace_drafts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!draft || draft.workspace_domain !== workspace) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = await getGitHubToken(userId);
  if (!token) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 });
  }

  // Ensure on draft branch
  await switchBranch(workspace, draft.branch_name);

  // Resolve each conflict
  for (const { file, choice } of resolutions) {
    await resolveConflict(workspace, file, choice);
  }

  // Finalize merge
  await finalizeMerge(workspace);

  // Push updated branch
  await pushBranch(workspace, draft.branch_name, token.accessToken);

  return NextResponse.json({ resolved: true });
}
```

### 5. Update API Wrapper (Final)

```typescript
// apps/web/lib/github/api.ts (complete)
const realGitApi = {
  // ... all existing methods ...

  updateDraft: async (workspace: string, draftId: string) => {
    const res = await fetch(`/api/git/drafts/${draftId}/update?workspace=${workspace}`, {
      method: 'POST',
    });
    return res.json();
  },

  resolveConflicts: async (workspace: string, draftId: string, resolutions: ConflictResolution[]) => {
    const res = await fetch(`/api/git/drafts/${draftId}/resolve?workspace=${workspace}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutions }),
    });
    return res.json();
  },
};

export const gitApi = process.env.NEXT_PUBLIC_MOCK_GITHUB === 'true' ? mockGitApi : realGitApi;
```

---

## AI Tests

```bash
# Setup: Create draft, then push a conflicting change to main on GitHub

# Check behind count
curl "https://terminal.goalive.nl/api/git/status?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"behindMain":1,...}

# Attempt update (will conflict)
DRAFT_ID="..."
curl -X POST "https://terminal.goalive.nl/api/git/drafts/$DRAFT_ID/update?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"updated":false,"hasConflicts":true,"conflictingFiles":["user/index.html"]}

# Resolve conflicts
curl -X POST "https://terminal.goalive.nl/api/git/drafts/$DRAFT_ID/resolve?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"resolutions":[{"file":"user/index.html","choice":"mine"}]}'
# Expected: {"resolved":true}

# Check status again
curl "https://terminal.goalive.nl/api/git/status?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"behindMain":0,...}
```

---

## Human Tests

### Setup
1. Create a draft "Test conflicts"
2. Make a change to `user/index.html` in the draft
3. Switch to main
4. On GitHub (or via terminal), edit the same file and commit to main

### Test Conflict Detection
5. Switch back to your draft
6. **Verify:** Shows "1 behind" badge

### Test Auto-Merge (No Conflict)
7. Create another draft
8. On GitHub, commit a change to a DIFFERENT file on main
9. Go back to draft, click "Update"
10. **Verify:** Merges automatically, "X behind" disappears

### Test Conflict Resolution
11. Switch to "Test conflicts" draft
12. Click "Update"
13. **Verify:** Conflict dialog appears
14. **Verify:** Shows conflicting file name
15. Click "Keep my version" for the file
16. Click Continue
17. **Verify:** Conflict resolved, no longer behind

### Verify on GitHub
18. Check the draft branch on GitHub
19. **Verify:** Merge commit exists with your resolution

---

## Definition of Done

- [ ] `conflict-ops.ts` handles merge operations
- [ ] Status includes behindMain count
- [ ] Update route attempts merge
- [ ] Conflict dialog shows conflicting files
- [ ] Resolve route applies choices
- [ ] Merge finalized and pushed
- [ ] "X behind" badge works
- [ ] Auto-merge works when no conflicts
- [ ] Conflict UI works when conflicts
- [ ] AI tests (curl) pass
- [ ] Human test flow works

---

## System Complete!

After Phase 10, the full GitHub integration is working:

1. Connect GitHub → OAuth + auto-create repo
2. See real dirty/clean status
3. Sync main → commit + push
4. Create drafts → real branches
5. Switch drafts → git checkout
6. Submit → real PRs
7. Update → merge main
8. Conflicts → binary resolution

Users can now work on multiple PRs in parallel without understanding git.
