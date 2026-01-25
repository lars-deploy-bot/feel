# Phase 9: PR Submission

**Time:** 3 hours
**Depends on:** Phase 8
**Deliverable:** Submit draft as real GitHub PR

---

## Goal

Replace mocked PR submission with real GitHub PR creation. User clicks "Submit for Review", branch is pushed, PR is created.

**Security:** All API routes require BOTH admin site AND admin user.

---

## Files to Create/Modify

### 1. PR Operations

```typescript
// apps/web/lib/github/pr-ops.ts
import { getInstallationOctokit } from './app-client';

interface CreatePRResult {
  number: number;
  url: string;
  state: 'open';
}

export async function createPullRequest(
  installationId: number,
  owner: string,
  repo: string,
  options: { title: string; head: string; base: string; body?: string }
): Promise<CreatePRResult> {
  const octokit = await getInstallationOctokit(installationId);

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: options.title,
    head: options.head,
    base: options.base,
    body: options.body || 'Created via GoAlive',
  });

  return {
    number: pr.number,
    url: pr.html_url,
    state: 'open',
  };
}

export async function getPRStatus(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ state: 'open' | 'merged' | 'closed' }> {
  const octokit = await getInstallationOctokit(installationId);

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  if (pr.merged) return { state: 'merged' };
  return { state: pr.state as 'open' | 'closed' };
}
```

### 2. Submit Route

```typescript
// apps/web/app/api/git/drafts/[id]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { getGitHubToken } from '@/lib/github/token-storage';
import { commitAndPush } from '@/lib/github/git-status';
import { pushBranch, switchBranch } from '@/lib/github/branch-ops';
import { createPullRequest } from '@/lib/github/pr-ops';

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

  // Get draft
  const { data: draft } = await supabaseAdmin
    .from('workspace_drafts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!draft || draft.workspace_domain !== workspace) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (draft.status !== 'editing') {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
  }

  // Get config
  const { data: config } = await supabaseAdmin
    .from('workspace_git_config')
    .select('*')
    .eq('workspace_domain', workspace)
    .single();

  if (!config?.repo_owner) {
    return NextResponse.json({ error: 'No repo' }, { status: 400 });
  }

  const token = await getGitHubToken(userId);
  if (!token) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 });
  }

  // Ensure on draft branch
  await switchBranch(workspace, draft.branch_name);

  // Commit any uncommitted changes
  try {
    await commitAndPush(workspace, `Update: ${draft.name}`, token.accessToken);
  } catch {
    // Push only if needed
  }

  // Push branch
  await pushBranch(workspace, draft.branch_name, token.accessToken);

  // Create PR
  const pr = await createPullRequest(
    config.github_installation_id,
    config.repo_owner,
    config.repo_name,
    {
      title: draft.name,
      head: draft.branch_name,
      base: 'main',
      body: `Draft: ${draft.name}\n\nCreated via GoAlive`,
    }
  );

  // Update draft
  await supabaseAdmin
    .from('workspace_drafts')
    .update({
      status: 'submitted',
      pr_number: pr.number,
      pr_url: pr.url,
      pr_state: 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft.id);

  return NextResponse.json({
    submitted: true,
    prNumber: pr.number,
    prUrl: pr.url,
  });
}
```

### 3. Delete Route

```typescript
// apps/web/app/api/git/drafts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { getGitHubToken } from '@/lib/github/token-storage';
import { deleteBranch, switchBranch } from '@/lib/github/branch-ops';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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

  const { data: config } = await supabaseAdmin
    .from('workspace_git_config')
    .select('active_draft_id')
    .eq('workspace_domain', workspace)
    .single();

  const token = await getGitHubToken(userId);

  // If active, switch to main first
  if (config?.active_draft_id === draft.id) {
    await switchBranch(workspace, 'main');
    await supabaseAdmin
      .from('workspace_git_config')
      .update({ active_draft_id: null })
      .eq('workspace_domain', workspace);
  }

  // Delete branch
  if (token) {
    await deleteBranch(workspace, draft.branch_name, token.accessToken);
  }

  // Delete from database
  await supabaseAdmin.from('workspace_drafts').delete().eq('id', draft.id);

  return NextResponse.json({ deleted: true });
}
```

### 4. Update API Wrapper

```typescript
// apps/web/lib/github/api.ts (final)
const realGitApi = {
  connect: (workspace: string) => {
    window.location.href = `/api/auth/github/install?workspace=${workspace}&returnUrl=${window.location.href}`;
  },
  disconnect: async (workspace: string) => {
    const res = await fetch(`/api/git/connection?workspace=${workspace}`, { method: 'DELETE' });
    return res.json();
  },
  getStatus: async (workspace: string) => {
    const res = await fetch(`/api/git/status?workspace=${workspace}`);
    return res.json();
  },
  syncMain: async (workspace: string) => {
    const res = await fetch(`/api/git/sync?workspace=${workspace}`, { method: 'POST' });
    return res.json();
  },
  getDrafts: async (workspace: string) => {
    const res = await fetch(`/api/git/drafts?workspace=${workspace}`);
    return res.json();
  },
  createDraft: async (workspace: string, name: string) => {
    const res = await fetch(`/api/git/drafts?workspace=${workspace}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },
  switchDraft: async (workspace: string, draftId: string) => {
    const res = await fetch(`/api/git/drafts/${draftId}/switch?workspace=${workspace}`, { method: 'POST' });
    return res.json();
  },
  switchToMain: async (workspace: string) => {
    const res = await fetch(`/api/git/drafts/main?workspace=${workspace}`, { method: 'POST' });
    return res.json();
  },
  submitDraft: async (workspace: string, draftId: string) => {
    const res = await fetch(`/api/git/drafts/${draftId}/submit?workspace=${workspace}`, { method: 'POST' });
    return res.json();
  },
  deleteDraft: async (workspace: string, draftId: string) => {
    const res = await fetch(`/api/git/drafts/${draftId}?workspace=${workspace}`, { method: 'DELETE' });
    return res.json();
  },

  // Still mocked until Phase 10
  updateDraft: mockGitApi.updateDraft,
  resolveConflicts: mockGitApi.resolveConflicts,
};

export const gitApi = process.env.NEXT_PUBLIC_MOCK_GITHUB === 'true' ? mockGitApi : realGitApi;
```

---

## AI Tests

```bash
# Create and switch to draft
curl -X POST "https://terminal.goalive.nl/api/git/drafts?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Test PR"}'

# Submit draft
DRAFT_ID="<id from above>"
curl -X POST "https://terminal.goalive.nl/api/git/drafts/$DRAFT_ID/submit?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"submitted":true,"prNumber":1,"prUrl":"https://github.com/..."}

# Verify PR exists on GitHub
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/demo-user/huurmatcher-alive-best/pulls/1"
# Expected: PR details

# List drafts, verify status changed
curl "https://terminal.goalive.nl/api/git/drafts?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: draft has status:"submitted", prNumber, prUrl

# Delete draft
curl -X DELETE "https://terminal.goalive.nl/api/git/drafts/$DRAFT_ID?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"deleted":true}
```

---

## Human Tests

1. Create a new draft "Test PR submission"
2. Make a small change to a file
3. Click draft indicator to open panel
4. Click "Submit for Review"
5. **Verify:** Loading state while submitting
6. **Verify:** Success message with PR link
7. Click the PR link
8. **Verify:** Opens GitHub, PR exists
9. **Verify:** PR title matches draft name
10. **Verify:** PR has correct branch → main
11. Go back to workspace
12. **Verify:** Draft shows "In Review" status
13. **Verify:** PR link visible in panel
14. On GitHub, merge the PR
15. Refresh workspace
16. **Verify:** Draft status changes to "Merged"
17. Delete the merged draft
18. **Verify:** Draft removed from list

---

## Definition of Done

- [ ] `pr-ops.ts` creates GitHub PRs
- [ ] Submit route pushes branch + creates PR
- [ ] PR stored in database
- [ ] PR link shown in UI
- [ ] Delete route removes branch
- [ ] Draft status updates to submitted
- [ ] Can click through to real PR
- [ ] AI tests (curl) pass
- [ ] Human test flow works
