# Phase 8: Branch Operations

**Time:** 4 hours
**Depends on:** Phase 7
**Deliverable:** Real branch create/switch for drafts

---

## Goal

Replace mocked draft operations with real git branches. Creating a draft creates a branch, switching drafts runs git checkout.

**Security:** All API routes require BOTH admin site AND admin user.

---

## Files to Create/Modify

### 1. Branch Operations

```typescript
// apps/web/lib/github/branch-ops.ts
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

export async function createBranch(domain: string, branchName: string): Promise<void> {
  const workspacePath = getWorkspacePath(domain);

  // Fetch latest main
  await git(['fetch', 'origin', 'main'], workspacePath);

  // Create branch from origin/main
  await git(['checkout', '-b', branchName, 'origin/main'], workspacePath);
}

export async function switchBranch(domain: string, branchName: string): Promise<void> {
  const workspacePath = getWorkspacePath(domain);

  // Stash any uncommitted changes
  try {
    await git(['stash', 'push', '-m', `auto-stash-${branchName}`], workspacePath);
  } catch {
    // No changes to stash
  }

  // Checkout branch
  await git(['checkout', branchName], workspacePath);

  // Try to pop stash
  try {
    await git(['stash', 'pop'], workspacePath);
  } catch {
    // No stash or conflicts
  }
}

export async function deleteBranch(domain: string, branchName: string, token: string): Promise<void> {
  const workspacePath = getWorkspacePath(domain);

  // Delete local
  try {
    await git(['branch', '-D', branchName], workspacePath);
  } catch {
    // Might not exist locally
  }

  // Delete remote
  try {
    await git(['push', 'origin', '--delete', branchName], workspacePath, token);
  } catch {
    // Might not exist on remote
  }
}

export async function pushBranch(domain: string, branchName: string, token: string): Promise<void> {
  const workspacePath = getWorkspacePath(domain);
  await git(['push', '-u', 'origin', branchName], workspacePath, token);
}
```

### 2. Database Migration

```sql
-- supabase/migrations/xxx_workspace_drafts.sql
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

-- Add FK for active_draft_id
ALTER TABLE app.workspace_git_config
  ADD CONSTRAINT fk_active_draft
  FOREIGN KEY (active_draft_id) REFERENCES app.workspace_drafts(id) ON DELETE SET NULL;
```

### 3. Drafts API - List

```typescript
// apps/web/app/api/git/drafts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';

export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace');

  const userId = await getCookieUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user email to check admin status
  const userEmail = await getUserEmail(userId);

  // Check BOTH admin site AND admin user
  if (!workspace || !isGitHubEnabled(workspace, userEmail)) {
    return NextResponse.json({ drafts: [] });
  }

  const { data: config } = await supabaseAdmin
    .from('workspace_git_config')
    .select('active_draft_id')
    .eq('workspace_domain', workspace)
    .single();

  const { data: drafts } = await supabaseAdmin
    .from('workspace_drafts')
    .select('*')
    .eq('workspace_domain', workspace)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    drafts: (drafts || []).map(d => ({
      id: d.id,
      name: d.name,
      status: d.status,
      branch: d.branch_name,
      prNumber: d.pr_number,
      prUrl: d.pr_url,
      prState: d.pr_state,
      isActive: d.id === config?.active_draft_id,
      createdAt: d.created_at,
    })),
  });
}
```

### 4. Drafts API - Create

```typescript
// apps/web/app/api/git/drafts/route.ts (POST)
import { nanoid } from 'nanoid';
import { createBranch } from '@/lib/github/branch-ops';
import { commitAndPush } from '@/lib/github/git-status';
import { getGitHubToken } from '@/lib/github/token-storage';
import { getUserEmail } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace');
  const { name } = await req.json();

  if (!workspace || !name) {
    return NextResponse.json({ error: 'workspace and name required' }, { status: 400 });
  }

  const userId = await getCookieUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user email to check admin status
  const userEmail = await getUserEmail(userId);

  // Check BOTH admin site AND admin user
  if (!isGitHubEnabled(workspace, userEmail)) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const token = await getGitHubToken(userId);
  if (!token) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 });
  }

  // Commit any uncommitted changes first
  try {
    await commitAndPush(workspace, 'Auto-save before creating draft', token.accessToken);
  } catch {
    // No changes to commit
  }

  // Create branch
  const branchName = `draft-${nanoid(8)}`;
  await createBranch(workspace, branchName);

  // Store in database
  const { data: draft, error } = await supabaseAdmin
    .from('workspace_drafts')
    .insert({
      workspace_domain: workspace,
      name,
      branch_name: branchName,
      base_branch: 'main',
      status: 'editing',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Set as active
  await supabaseAdmin
    .from('workspace_git_config')
    .update({ active_draft_id: draft.id })
    .eq('workspace_domain', workspace);

  return NextResponse.json({
    id: draft.id,
    name: draft.name,
    branch: draft.branch_name,
    status: 'editing',
  });
}
```

### 5. Drafts API - Switch

```typescript
// apps/web/app/api/git/drafts/[id]/switch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { switchBranch } from '@/lib/github/branch-ops';
import { isGitHubEnabled } from '@/lib/github/feature-flag';

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

  await switchBranch(workspace, draft.branch_name);

  await supabaseAdmin
    .from('workspace_git_config')
    .update({ active_draft_id: draft.id })
    .eq('workspace_domain', workspace);

  return NextResponse.json({ switched: true });
}
```

### 6. Drafts API - Switch to Main

```typescript
// apps/web/app/api/git/drafts/main/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { switchBranch } from '@/lib/github/branch-ops';
import { isGitHubEnabled } from '@/lib/github/feature-flag';

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

  await switchBranch(workspace, 'main');

  await supabaseAdmin
    .from('workspace_git_config')
    .update({ active_draft_id: null })
    .eq('workspace_domain', workspace);

  return NextResponse.json({ switched: true, branch: 'main' });
}
```

### 7. Update API Wrapper

```typescript
// apps/web/lib/github/api.ts (update)
const realGitApi = {
  // ... existing ...

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
    const res = await fetch(`/api/git/drafts/${draftId}/switch?workspace=${workspace}`, {
      method: 'POST',
    });
    return res.json();
  },

  switchToMain: async (workspace: string) => {
    const res = await fetch(`/api/git/drafts/main?workspace=${workspace}`, {
      method: 'POST',
    });
    return res.json();
  },

  // Still mocked
  submitDraft: mockGitApi.submitDraft,
  deleteDraft: mockGitApi.deleteDraft,
};
```

---

## AI Tests

```bash
# Create draft
curl -X POST "https://terminal.goalive.nl/api/git/drafts?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Add contact form"}'
# Expected: {"id":"...","name":"Add contact form","branch":"draft-abc123",...}

# List drafts
curl "https://terminal.goalive.nl/api/git/drafts?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"drafts":[{"id":"...","name":"Add contact form","isActive":true,...}]}

# Verify branch exists
ssh root@server "cd /srv/webalive/sites/huurmatcher.alive.best && git branch"
# Expected: * draft-abc123, main

# Switch to main
curl -X POST "https://terminal.goalive.nl/api/git/drafts/main?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"switched":true,"branch":"main"}

# Verify on main
ssh root@server "cd /srv/webalive/sites/huurmatcher.alive.best && git branch --show-current"
# Expected: main
```

---

## Human Tests

1. While on main, click "New Draft"
2. Enter "Add contact form"
3. Click Create
4. **Verify:** Header changes to show "Add contact form"
5. **Verify:** Git branch was created (check GitHub)
6. Make some changes to a file
7. Click "New Draft" again, create "Fix header"
8. **Verify:** Switched to new draft
9. Open draft panel
10. **Verify:** Both drafts listed
11. Click on "Add contact form" to switch
12. **Verify:** Switched back (header changes)
13. Click "Back to main"
14. **Verify:** Header shows "main"

---

## Definition of Done

- [ ] `branch-ops.ts` creates/switches branches
- [ ] Database migration for workspace_drafts
- [ ] Create draft creates real git branch
- [ ] Draft stored in database
- [ ] Switch draft runs git checkout
- [ ] Switch to main works
- [ ] List drafts returns real data
- [ ] AI tests (curl) pass
- [ ] Human test flow works
