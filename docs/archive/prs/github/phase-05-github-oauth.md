# Phase 5: GitHub OAuth Flow

**Time:** 4 hours
**Depends on:** Phase 4
**Deliverable:** Real GitHub App OAuth (no repo yet)

---

## Goal

Replace mock connect with real GitHub App OAuth. User can authorize, token is stored securely. No repo creation yet.

---

## Prerequisites

1. **Create GitHub App** at https://github.com/settings/apps
   - Name: `GoAlive`
   - Callback URL: `https://terminal.goalive.nl/api/auth/github/callback`
   - Webhook: Disabled
   - Permissions: Contents (R/W), Pull requests (R/W), Metadata (Read)

2. **Set environment variables:**
   ```bash
   GITHUB_APP_ID=123456
   GITHUB_APP_SLUG=goalive
   GITHUB_CLIENT_ID=Iv1.xxx
   GITHUB_CLIENT_SECRET=xxx
   GITHUB_PRIVATE_KEY="REDACTED_PRIVATE_KEY"
   ```

3. **Run migration:**
   ```sql
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

---

## Files to Create

### 1. GitHub App Client

```typescript
// apps/web/lib/github/app-client.ts
import { App, Octokit } from '@octokit/app';
import { createAppAuth } from '@octokit/auth-app';

let app: App | null = null;

export function getGitHubApp(): App {
  if (app) return app;
  app = new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_PRIVATE_KEY!,
    oauth: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  });
  return app;
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  return getGitHubApp().getInstallationOctokit(installationId);
}

export function getAppOctokit(): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_PRIVATE_KEY!,
    },
  });
}
```

### 2. Token Storage

```typescript
// apps/web/lib/github/token-storage.ts
import { lockbox } from '@webalive/oauth-core';

const PROVIDER = 'github-app';

interface GitHubToken {
  accessToken: string;
  refreshToken?: string;
  installationId: number;
  userId: number;
  username: string;
  expiresAt?: Date;
}

export async function storeGitHubToken(bridgeUserId: string, token: GitHubToken): Promise<void> {
  await lockbox.store({
    userId: bridgeUserId,
    provider: PROVIDER,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    metadata: {
      installationId: token.installationId,
      githubUserId: token.userId,
      githubUsername: token.username,
    },
  });
}

export async function getGitHubToken(bridgeUserId: string): Promise<GitHubToken | null> {
  const data = await lockbox.get(bridgeUserId, PROVIDER);
  if (!data) return null;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? undefined,
    installationId: data.metadata?.installationId,
    userId: data.metadata?.githubUserId,
    username: data.metadata?.githubUsername,
    expiresAt: data.expiresAt ?? undefined,
  };
}

export async function deleteGitHubToken(bridgeUserId: string): Promise<void> {
  await lockbox.revoke(bridgeUserId, PROVIDER);
}
```

### 3. Install Route (Redirect to GitHub)

```typescript
// apps/web/app/api/auth/github/install/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
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
    return NextResponse.json({ error: 'GitHub not available' }, { status: 403 });
  }

  // Encode state
  const state = Buffer.from(JSON.stringify({
    userId,
    userEmail,
    workspace,
    returnUrl: req.nextUrl.searchParams.get('returnUrl') || `https://${workspace}`,
  })).toString('base64');

  const installUrl = new URL(`https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`);
  installUrl.searchParams.set('state', state);

  return NextResponse.redirect(installUrl.toString());
}
```

### 4. Callback Route

```typescript
// apps/web/app/api/auth/github/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { getGitHubApp } from '@/lib/github/app-client';
import { storeGitHubToken } from '@/lib/github/token-storage';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const installationId = req.nextUrl.searchParams.get('installation_id');

  if (!code || !stateParam || !installationId) {
    return NextResponse.redirect('/error?message=missing-params');
  }

  // Decode state
  let state: { userId: string; userEmail: string; workspace: string; returnUrl: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
  } catch {
    return NextResponse.redirect('/error?message=invalid-state');
  }

  // Verify BOTH admin site AND admin user
  if (!isGitHubEnabled(state.workspace, state.userEmail)) {
    return NextResponse.redirect('/error?message=github-not-available');
  }

  try {
    const app = getGitHubApp();
    const { authentication } = await app.oauth.createToken({ code });

    // Get user info
    const octokit = new Octokit({ auth: authentication.token });
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // Store token
    await storeGitHubToken(state.userId, {
      accessToken: authentication.token,
      refreshToken: authentication.refreshToken,
      installationId: parseInt(installationId, 10),
      userId: user.id,
      username: user.login,
      expiresAt: authentication.expiresAt ? new Date(authentication.expiresAt) : undefined,
    });

    // Create workspace config (no repo yet)
    await supabaseAdmin.from('workspace_git_config').upsert({
      workspace_domain: state.workspace,
      github_installation_id: parseInt(installationId, 10),
      github_user_id: user.id,
      github_username: user.login,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_domain' });

    // Redirect back
    const returnUrl = new URL(state.returnUrl);
    returnUrl.searchParams.set('github', 'connected');
    return NextResponse.redirect(returnUrl.toString());

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect('/error?message=oauth-failed');
  }
}
```

### 5. Status Route

```typescript
// apps/web/app/api/git/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';

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

  return NextResponse.json({
    enabled: true,
    connected: true,
    username: config.github_username,
    repo: config.repo_owner ? {
      owner: config.repo_owner,
      name: config.repo_name,
      url: `https://github.com/${config.repo_owner}/${config.repo_name}`,
    } : null,
    // These will be real in Phase 7
    onMain: true,
    isDirty: false,
    changedFiles: 0,
    behindMain: 0,
  });
}
```

### 6. Disconnect Route

```typescript
// apps/web/app/api/git/connection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCookieUserId, getUserEmail } from '@/lib/auth';
import { deleteGitHubToken } from '@/lib/github/token-storage';
import { supabaseAdmin } from '@/lib/supabase';
import { isGitHubEnabled } from '@/lib/github/feature-flag';

export async function DELETE(req: NextRequest) {
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

  await deleteGitHubToken(userId);
  await supabaseAdmin.from('workspace_git_config').delete().eq('workspace_domain', workspace);

  return NextResponse.json({ disconnected: true });
}
```

### 7. Update API Wrapper

```typescript
// apps/web/lib/github/api.ts
import { mockGitApi } from './mock-api';

const USE_MOCK = process.env.NEXT_PUBLIC_MOCK_GITHUB === 'true';

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
  // Still mocked until later phases
  getDrafts: mockGitApi.getDrafts,
  createDraft: mockGitApi.createDraft,
  switchDraft: mockGitApi.switchDraft,
  switchToMain: mockGitApi.switchToMain,
  submitDraft: mockGitApi.submitDraft,
  deleteDraft: mockGitApi.deleteDraft,
};

export const gitApi = USE_MOCK ? mockGitApi : realGitApi;
```

---

## AI Tests

```bash
# Test install redirect (should return 302)
curl -I "https://terminal.goalive.nl/api/auth/github/install?workspace=huurmatcher.alive.best"
# Expected: HTTP/2 302, Location: https://github.com/apps/goalive/installations/new?state=...

# Test status (not connected)
curl "https://terminal.goalive.nl/api/git/status?workspace=huurmatcher.alive.best" \
  -H "Cookie: session=..."
# Expected: {"enabled":true,"connected":false}

# Test feature flag rejection
curl "https://terminal.goalive.nl/api/git/status?workspace=random.site.com"
# Expected: {"enabled":false,"connected":false}
```

```typescript
// apps/web/app/api/git/__tests__/status.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/github/feature-flag', () => ({
  isGitHubEnabled: vi.fn((w) => w === 'huurmatcher.alive.best'),
}));

describe('GET /api/git/status', () => {
  it('returns enabled:false for non-admin workspace', async () => {
    const res = await fetch('/api/git/status?workspace=random.site.com');
    const data = await res.json();
    expect(data.enabled).toBe(false);
  });
});
```

---

## Human Tests

1. Go to `https://huurmatcher.alive.best`
2. Open Settings, click "Connect GitHub"
3. **Verify:** Redirected to GitHub authorization page
4. Authorize the app
5. **Verify:** Redirected back with `?github=connected`
6. **Verify:** Settings shows "Connected" with username
7. Refresh page
8. **Verify:** Still shows connected (persisted)
9. Click "Disconnect"
10. **Verify:** Back to "Connect GitHub" button
11. Reconnect
12. **Verify:** Works again

---

## Definition of Done

- [ ] GitHub App created and configured
- [ ] Environment variables set
- [ ] Database migration applied
- [ ] Install route redirects to GitHub
- [ ] Callback stores token in lockbox
- [ ] Callback creates workspace_git_config
- [ ] Status returns real connection state
- [ ] Disconnect removes all data
- [ ] AI tests pass (curl commands)
- [ ] Human test flow works
