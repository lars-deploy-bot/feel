# Phase 7: Git Status Detection

**Time:** 3 hours
**Depends on:** Phase 6
**Deliverable:** Real dirty/clean status, sync main button

---

## Goal

Replace mocked status with real git status. User sees actual file changes, can sync (commit + push) to main.

**Security:** All API routes require BOTH admin site AND admin user.

---

## Files to Create/Modify

### 1. Git Status Operations

```typescript
// apps/web/lib/github/git-status.ts
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

export async function getGitStatus(domain: string): Promise<{
  isDirty: boolean;
  changedFiles: number;
  untrackedFiles: number;
}> {
  const workspacePath = getWorkspacePath(domain);
  const status = await git(['status', '--porcelain'], workspacePath);
  const lines = status.split('\n').filter(Boolean);

  return {
    isDirty: lines.length > 0,
    changedFiles: lines.filter(l => !l.startsWith('??')).length,
    untrackedFiles: lines.filter(l => l.startsWith('??')).length,
  };
}

export async function getCurrentBranch(domain: string): Promise<string> {
  const workspacePath = getWorkspacePath(domain);
  return git(['branch', '--show-current'], workspacePath);
}

export async function commitAndPush(
  domain: string,
  message: string,
  token: string
): Promise<{ committed: boolean; commitHash?: string }> {
  const workspacePath = getWorkspacePath(domain);

  // Add all changes
  await git(['add', '-A'], workspacePath);

  // Check if anything to commit
  const status = await getGitStatus(domain);
  if (!status.isDirty) {
    return { committed: false };
  }

  // Commit
  await git(['commit', '-m', message], workspacePath);

  // Push
  await git(['push', 'origin', 'main'], workspacePath, token);

  // Get commit hash
  const commitHash = await git(['rev-parse', 'HEAD'], workspacePath);

  return { committed: true, commitHash };
}
```

### 2. Update Status Route

```typescript
// apps/web/app/api/git/status/route.ts (update)
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { getGitStatus, getCurrentBranch } from '@/lib/github/git-status';

// Replace mocked status with real:
export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace');

  if (!workspace) {
    return NextResponse.json({ error: 'workspace required' }, { status: 400 });
  }

  const userId = await getCookieUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user email to check admin status
  const userEmail = await getUserEmail(userId);

  // Check BOTH admin site AND admin user
  if (!isGitHubEnabled(workspace, userEmail)) {
    return NextResponse.json({ enabled: false, connected: false });
  }

  const { data: config } = await supabaseAdmin
    .from('workspace_git_config')
    .select('*')
    .eq('workspace_domain', workspace)
    .single();

  if (!config) {
    return NextResponse.json({ enabled: true, connected: false });
  }

  // Get real git status
  let isDirty = false;
  let changedFiles = 0;
  let currentBranch = 'main';

  try {
    const status = await getGitStatus(workspace);
    isDirty = status.isDirty;
    changedFiles = status.changedFiles + status.untrackedFiles;
    currentBranch = await getCurrentBranch(workspace);
  } catch (error) {
    console.error('Git status error:', error);
    // Fall back to defaults
  }

  return NextResponse.json({
    enabled: true,
    connected: true,
    username: config.github_username,
    repo: config.repo_owner ? {
      owner: config.repo_owner,
      name: config.repo_name,
      url: `https://github.com/${config.repo_owner}/${config.repo_name}`,
    } : null,
    onMain: currentBranch === 'main',
    isDirty,
    changedFiles,
    activeDraft: config.active_draft_id ? {
      id: config.active_draft_id,
      // Will be populated in Phase 8
    } : null,
    behindMain: 0, // Will be real in Phase 10
    lastSynced: config.last_synced_at,
  });
}
```

### 3. Sync Route

```typescript
// apps/web/app/api/git/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { getGitHubToken } from '@/lib/github/token-storage';
import { commitAndPush, getGitStatus } from '@/lib/github/git-status';

export async function POST(req: NextRequest) {
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

  const token = await getGitHubToken(userId);
  if (!token) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 });
  }

  // Check if dirty
  const status = await getGitStatus(workspace);
  if (!status.isDirty) {
    return NextResponse.json({ synced: false, message: 'No changes to sync' });
  }

  // Commit and push
  const result = await commitAndPush(
    workspace,
    `Update from GoAlive (${new Date().toISOString()})`,
    token.accessToken
  );

  if (result.committed) {
    // Update last synced
    await supabaseAdmin
      .from('workspace_git_config')
      .update({
        last_synced_at: new Date().toISOString(),
        last_synced_commit: result.commitHash,
      })
      .eq('workspace_domain', workspace);
  }

  return NextResponse.json({
    synced: result.committed,
    commitHash: result.commitHash,
  });
}
```

### 4. Sync Button Component

```typescript
// apps/web/components/git/SyncButton.tsx
'use client';

import { RefreshCw, Check } from 'lucide-react';
import { useGitHubStatus } from '@/hooks/use-github-status';
import { useUser } from '@/hooks/use-user';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import useSWRMutation from 'swr/mutation';

export function SyncButton({ workspace }: { workspace: string }) {
  const { data: user } = useUser();
  const { data: status, mutate } = useGitHubStatus(workspace, user?.email);

  // Feature flag check - requires BOTH admin site AND admin user
  if (!isGitHubEnabled(workspace, user?.email)) {
    return null;
  }

  const { trigger: sync, isMutating } = useSWRMutation(
    ['sync', workspace],
    async () => {
      const res = await fetch(`/api/git/sync?workspace=${workspace}`, { method: 'POST' });
      const data = await res.json();
      mutate();
      return data;
    }
  );

  if (!status?.connected || !status?.onMain) return null;

  return (
    <button
      onClick={() => sync()}
      disabled={isMutating || !status.isDirty}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
        status.isDirty
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      {isMutating ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Syncing...
        </>
      ) : status.isDirty ? (
        <>
          <RefreshCw className="w-4 h-4" />
          Sync ({status.changedFiles})
        </>
      ) : (
        <>
          <Check className="w-4 h-4" />
          Synced
        </>
      )}
    </button>
  );
}
```

### 5. Update API Wrapper

```typescript
// apps/web/lib/github/api.ts (update)
const realGitApi = {
  // ... existing methods ...

  syncMain: async (workspace: string) => {
    const res = await fetch(`/api/git/sync?workspace=${workspace}`, { method: 'POST' });
    return res.json();
  },

  // Still mocked
  getDrafts: mockGitApi.getDrafts,
  createDraft: mockGitApi.createDraft,
  // ...
};
```

---

## AI Tests

```bash
# Test status when clean
curl "https://terminal.goalive.nl/api/git/status?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"isDirty":false,"changedFiles":0,...}

# Create a file to make dirty
ssh root@server "echo 'test' >> /srv/webalive/sites/huurmatcher.alive.best/user/test.txt"

# Test status when dirty
curl "https://terminal.goalive.nl/api/git/status?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"isDirty":true,"changedFiles":1,...}

# Test sync
curl -X POST "https://terminal.goalive.nl/api/git/sync?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"synced":true,"commitHash":"abc123..."}

# Verify status is clean after sync
curl "https://terminal.goalive.nl/api/git/status?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"isDirty":false,...}
```

```typescript
// apps/web/lib/github/__tests__/git-status.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getGitStatus } from '../git-status';

vi.mock('@/lib/workspace-execution/command-runner', () => ({
  runAsWorkspaceUser: vi.fn(({ args }) => {
    if (args[0] === 'status') {
      return { exitCode: 0, stdout: ' M file.txt\n?? new.txt\n', stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  }),
}));

describe('getGitStatus', () => {
  it('parses git status output', async () => {
    const status = await getGitStatus('test.domain.com');
    expect(status.isDirty).toBe(true);
    expect(status.changedFiles).toBe(1);
    expect(status.untrackedFiles).toBe(1);
  });
});
```

---

## Human Tests

1. Connect GitHub and verify repo created
2. **Verify:** DraftIndicator shows "main" with no orange dot
3. **Verify:** Sync button says "Synced" (disabled)
4. Open file editor, make a change to any file
5. Save the file
6. **Verify:** Orange dot appears on "main"
7. **Verify:** Sync button shows "Sync (1)" and is enabled
8. Click Sync button
9. **Verify:** Loading state while syncing
10. **Verify:** After sync, button shows "Synced" again
11. Go to GitHub repo
12. **Verify:** New commit appears with your changes

---

## Definition of Done

- [ ] `git-status.ts` reads real git status
- [ ] Status route returns real isDirty/changedFiles
- [ ] Sync route commits and pushes
- [ ] SyncButton shows correct state
- [ ] Orange dot appears when dirty
- [ ] Sync button enables when dirty
- [ ] After sync, status is clean
- [ ] Commit appears on GitHub
- [ ] AI tests (curl) pass
- [ ] Human test flow works
