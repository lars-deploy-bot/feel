# RFC: GitHub Git Integration

**Status:** Draft
**RFC ID:** RFC-2025-001
**Author:** Lars / Claude
**Created:** 2025-01-20

---

## Summary

Users can connect their workspace to GitHub. We create a repo for them automatically. They can switch to their own repo later. Branch indicator in header (only visible when connected). One-click sync to push changes.

## Problem

No version control, no backup, no collaboration, no CI/CD. Git is table stakes.

## Decisions Made

| Question | Decision |
|----------|----------|
| GitHub App vs OAuth App | **GitHub App** - fine-grained permissions, user picks repos, short-lived tokens |
| Create repo for user? | **Yes** - we create repo automatically, user can switch to their own later |
| Auto-sync via webhook? | **No** - manual sync only |
| Git UI when not connected | **Prompt** - show instruction (like photo uploads) to connect |
| Commit message | **Auto-generate** - e.g. "Update from GoAlive" |
| Push behavior | **Branch always active** - changes sync to active branch |

## Existing Infrastructure

- `@webalive/oauth-core` with `GitHubProvider` - needs update for GitHub App
- `lockbox.user_secrets` for encrypted token storage - ready
- Integrations UI with connect/disconnect flow - ready

---

## User Flow

### First time: Connect GitHub

1. User sees prompt in header: "Connect to GitHub to back up your work"
2. User clicks → GitHub App installation flow opens
3. User authorizes GoAlive GitHub App
4. We automatically create repo: `goalive-backup/[workspace-name]` (or user's account)
5. Initial commit + push of all workspace files
6. Branch indicator appears: `main ✓`

### Ongoing: Sync changes

1. User makes changes via Claude or file editor
2. Branch indicator shows: `main •` (dot = uncommitted changes)
3. User clicks branch indicator → opens sync panel
4. User clicks "Sync" → auto-commit with generated message + push
5. Branch indicator shows: `main ✓` (checkmark = synced)

### Optional: Switch to own repo

1. User goes to Settings > Git
2. Clicks "Use my own repository"
3. Selects repo from their GitHub (repos they gave us access to)
4. We set new remote, push current state
5. Old goalive-backup repo remains (they can delete manually)

---

## Lars: Manual Setup (~30 min)

### Step 1: Create GitHub App

1. Go to https://github.com/settings/apps
2. Click **"New GitHub App"**
3. Fill in:

| Field | Value |
|-------|-------|
| GitHub App name | `GoAlive` |
| Homepage URL | `https://goalive.nl` |
| Callback URL | `https://terminal.goalive.nl/api/auth/github/callback` |
| Setup URL (optional) | `https://terminal.goalive.nl/api/auth/github/setup` |
| Webhook | **Inactive** (we don't need webhooks) |

4. **Permissions** (Repository permissions):

| Permission | Access |
|------------|--------|
| Contents | **Read and write** |
| Metadata | **Read-only** |

5. **Permissions** (Account permissions):

| Permission | Access |
|------------|--------|
| Email addresses | **Read-only** |

6. **Where can this GitHub App be installed?** → "Any account"

7. Click **"Create GitHub App"**

8. On the next page:
   - Copy **App ID** (numeric)
   - Copy **Client ID** (starts with `Iv1.`)
   - Click **"Generate a new client secret"** → copy it
   - Scroll to **"Private keys"** → click **"Generate a private key"** → downloads `.pem` file

**Save all 4 values.**

### Step 2: Add Environment Variables

```bash
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...contents of .pem file...
-----END RSA PRIVATE KEY-----"
```

**Note:** Private key is multiline. Ensure it's properly escaped/quoted for your env system.

### Step 3: Seed Database

Run in Supabase SQL Editor:

```sql
-- 1. Add GitHub to integrations list
INSERT INTO app.integration_visibility (provider_key, display_name, logo_path, visibility_status)
VALUES ('github', 'GitHub', '/integrations/github.svg', 'beta');

-- 2. Grant yourself beta access
INSERT INTO app.integration_access (provider_key, org_id, granted_by)
SELECT 'github', om.org_id, 'manual'
FROM iam.org_memberships om
JOIN iam.users u ON u.id = om.user_id
WHERE u.email = 'admin@example.com';

-- 3. Verify
SELECT * FROM app.integration_visibility WHERE provider_key = 'github';
```

### Step 4: Add GitHub Logo

Save to `apps/web/public/integrations/github.svg`

### Step 5: Restart Services

```bash
systemctl restart claude-bridge-production
```

### Verification Checklist

- [ ] GitHub App created at github.com/settings/apps
- [ ] `GITHUB_APP_ID` env var set (numeric)
- [ ] `GITHUB_CLIENT_ID` env var set (starts with `Iv1.`)
- [ ] `GITHUB_CLIENT_SECRET` env var set
- [ ] `GITHUB_PRIVATE_KEY` env var set (multiline PEM)
- [ ] SQL ran successfully
- [ ] `github.svg` exists
- [ ] Services restarted

**Done. Tell Claude to start implementation.**

---

## Claude: Implementation

### Phase 1: GitHub App Auth (~3h)

**Note:** GitHub App auth is different from OAuth App. We need to handle both user auth (OAuth) and app installation.

#### 1.1 Install flow route

**File:** `apps/web/app/api/auth/github/install/route.ts`

Redirects user to GitHub App installation:
```
https://github.com/apps/goalive/installations/new
```

#### 1.2 Callback route

**File:** `apps/web/app/api/auth/github/callback/route.ts`

Handles OAuth callback after installation:
- Receives `code` and `installation_id`
- Exchange code for user access token
- Store installation_id for this user
- Store user access token (encrypted)

#### 1.3 Setup route (post-installation)

**File:** `apps/web/app/api/auth/github/setup/route.ts`

Called after user installs app:
- Links installation to user account
- Redirects back to app with success

#### 1.4 GitHub App client

**File:** `apps/web/lib/github/app-client.ts`

```typescript
import { App } from '@octokit/app'

export function createGitHubApp() {
  return new App({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_PRIVATE_KEY,
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  })
}

export async function getInstallationClient(installationId: number) {
  const app = createGitHubApp()
  return app.getInstallationOctokit(installationId)
}
```

#### 1.5 Update env schema

**File:** `packages/env/src/schema.ts`

```typescript
GITHUB_APP_ID: z.string().min(1),
GITHUB_CLIENT_ID: z.string().min(1),
GITHUB_CLIENT_SECRET: z.string().min(1),
GITHUB_PRIVATE_KEY: z.string().min(1),
```

#### 1.6 Dependencies

```bash
bun add @octokit/app @octokit/rest
```

**Phase 1 complete when:** User can install GitHub App and we store their installation_id.

---

### Phase 2: Auto-create Repo + Initial Push (~4h)

#### 2.1 Create repo for workspace

**File:** `apps/web/lib/github/repo-manager.ts`

```typescript
export async function createWorkspaceRepo(
  installationId: number,
  workspaceDomain: string
): Promise<{ owner: string; repo: string; url: string }>

export async function pushWorkspaceToRepo(
  installationId: number,
  workspacePath: string,
  repoUrl: string,
  branch: string
): Promise<void>

export async function switchRepo(
  installationId: number,
  workspacePath: string,
  newRepoUrl: string
): Promise<void>
```

#### 2.2 Auto-setup after GitHub connect

When user completes GitHub App installation:
1. Create repo named `[workspace-domain]` (sanitized)
2. Init git in workspace (if not already)
3. Add remote
4. Initial commit: "Initial commit from GoAlive"
5. Push to main

#### 2.3 API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/git/status` | GET | Get status (branch, dirty, synced) |
| `/api/git/sync` | POST | Auto-commit + push |
| `/api/git/repos` | GET | List user's repos (for switch flow) |
| `/api/git/switch` | POST | Switch to different repo |

#### 2.4 Database migration

**File:** `supabase/migrations/[timestamp]_workspace_git_config.sql`

```sql
CREATE TABLE app.workspace_git_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE REFERENCES app.domains(domain) ON DELETE CASCADE,
  github_installation_id BIGINT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workspace_git_config_domain ON app.workspace_git_config(domain);
```

**Phase 2 complete when:** Connecting GitHub auto-creates repo and pushes workspace files.

---

### Phase 3: Frontend (~6h)

#### 3.1 Connect prompt (when not connected)

**File:** `apps/web/components/git/GitConnectPrompt.tsx`

Small prompt in header area (like photo upload instruction):
- "Back up your work to GitHub"
- [Connect GitHub] button
- Dismissible (stores preference)

#### 3.2 Branch indicator (when connected)

**File:** `apps/web/components/git/BranchIndicator.tsx`

Shows in header when git is connected:
- `main ✓` = synced (green checkmark)
- `main •` = has changes (orange dot)
- Click opens sync panel

#### 3.3 Sync panel

**File:** `apps/web/components/git/SyncPanel.tsx`

Simple panel (popover or slide-over):
- Shows current branch
- Shows status: "Synced" or "X files changed"
- [Sync Now] button - auto-commits with message "Update from GoAlive" + pushes
- Link to GitHub repo
- "Switch repository" link → opens modal

#### 3.4 Switch repo modal

**File:** `apps/web/components/git/SwitchRepoModal.tsx`

- Lists repos user has given access to
- Search/filter
- Select → confirms → switches remote

#### 3.5 Git settings section

**File:** `apps/web/components/settings/GitSettings.tsx`

- Shows connected repo (link to GitHub)
- Current branch
- [Disconnect] button
- [Switch Repository] button

#### 3.6 Hooks

**File:** `apps/web/hooks/use-git.ts`

```typescript
export function useGitStatus(workspace: string)
export function useGitSync()
export function useGitHubRepos()
export function useSwitchRepo()
```

**Phase 3 complete when:** Full flow works from connect → sync → switch repo.

---

### Phase 4: Tests (~2h)

| Test | Coverage |
|------|----------|
| GitHub App auth flow | Installation callback, token storage |
| Repo creation | API mock, verify repo created |
| Sync flow | Commit message generation, push |
| Switch repo | Remote update, push to new repo |

---

## Auto-generated Commit Messages

Format: `Update from GoAlive`

Or with more detail (optional enhancement):
- `Update from GoAlive: 3 files changed`
- `Update from GoAlive: index.html, styles.css`

Keep it simple for v1: just `Update from GoAlive`.

---

## Security

| Risk | Mitigation |
|------|------------|
| Token exposure | Never log tokens, use GitHub App (short-lived) |
| Installation token | 1-hour expiry, auto-refresh via @octokit/app |
| Repo access | User explicitly grants access during installation |
| Private key | Store in env, never in code |

---

## File Changes Summary

```
apps/web/
├── app/api/auth/github/
│   ├── install/route.ts       # NEW - Start installation
│   ├── callback/route.ts      # NEW - OAuth callback
│   └── setup/route.ts         # NEW - Post-install setup
├── app/api/git/
│   ├── status/route.ts        # NEW
│   ├── sync/route.ts          # NEW
│   ├── repos/route.ts         # NEW
│   └── switch/route.ts        # NEW
├── components/git/
│   ├── GitConnectPrompt.tsx   # NEW
│   ├── BranchIndicator.tsx    # NEW
│   ├── SyncPanel.tsx          # NEW
│   └── SwitchRepoModal.tsx    # NEW
├── components/settings/
│   └── GitSettings.tsx        # NEW
├── hooks/
│   └── use-git.ts             # NEW
└── lib/github/
    ├── app-client.ts          # NEW
    └── repo-manager.ts        # NEW

packages/env/src/
└── schema.ts                  # UPDATE
```

---

## Dependencies

```bash
bun add @octokit/app @octokit/rest
```

---

## Rollout

| Phase | Audience | Gate |
|-------|----------|------|
| Alpha | Lars only | Basic flow works |
| Beta | 10 users | 1 week, no critical bugs |
| GA | All | Positive feedback |

---

## Definition of Done

- [ ] GitHub App created and configured
- [ ] User can install GitHub App from GoAlive
- [ ] Repo auto-created on first connect
- [ ] Initial push works
- [ ] Connect prompt shows for unconnected workspaces
- [ ] Branch indicator shows sync status
- [ ] One-click sync works (auto-commit + push)
- [ ] User can switch to their own repo
- [ ] All tests pass
- [ ] No tokens in logs

---

## References

- [GitHub Apps vs OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [Creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/creating-a-github-app)
- [@octokit/app documentation](https://github.com/octokit/app.js)
- [Vercel GitHub Integration](https://vercel.com/docs/git/vercel-for-github)
