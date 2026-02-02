# RFC: 2-Stage GitHub OAuth Flow

**Status:** Draft
**RFC ID:** RFC-2025-002
**Author:** Lars / Claude
**Created:** 2026-02-02
**Depends on:** Existing OAuth infrastructure

---

## Summary

Implement a 2-stage GitHub connection flow similar to Manus:

1. **Stage 1: Authorize Account** - OAuth flow for user-level permissions (identity, email, gists)
2. **Stage 2: Authorize Repository** - GitHub App installation for repo-level permissions (code, issues, PRs)

This separates "who is the user" from "what repos can we access" - a pattern used by professional integrations.

---

## Problem

Current GitHub integration is single-stage OAuth App flow that:
- Requests all permissions upfront (user rejects broad permissions)
- Can't granularly control which repositories are accessible
- Uses long-lived tokens (security concern)
- Doesn't match user expectations from tools like Vercel, Manus, Railway

---

## Proposed Solution

### Two Separate Authorization Flows

| Stage | Name | What It Does | When |
|-------|------|--------------|------|
| **1** | Authorize Account | OAuth 2.0 user auth | First time connecting |
| **2** | Authorize Repository | GitHub App installation | After account auth, on demand |

### Stage 1: Authorize Account

**User Flow:**
1. User clicks "Connect GitHub" in Settings
2. Redirected to GitHub OAuth consent screen
3. Grants user-level permissions only
4. Redirected back with OAuth token
5. UI shows "GitHub Connected" with username
6. New button appears: "Add Repositories"

**Permissions Requested (User-level):**
- `user:email` - Read email addresses
- `gist` - Create/manage gists (optional, for code sharing)

**What Gets Stored:**
```typescript
// In lockbox (oauth-core)
{
  provider: "github",
  access_token: "gho_xxx",  // User OAuth token
  scope: "user:email gist",
  // NO installation_id yet
}
```

### Stage 2: Authorize Repository

**User Flow:**
1. User clicks "Add Repositories" or "Authorize Repository"
2. Redirected to GitHub App installation page: `https://github.com/apps/goalive/installations/new`
3. User selects repositories to grant access
4. GitHub redirects back with `installation_id`
5. We store installation_id linked to user
6. UI shows connected repositories with "Manage" link

**Permissions Requested (Repository-level via GitHub App):**
- Metadata: Read-only
- Contents: Read and write
- Issues: Read and write
- Pull requests: Read and write
- Administration: Read and write (for repo settings)
- Environments: Read and write
- Repository projects: Read and write

**What Gets Stored:**
```typescript
// In lockbox (oauth-core) - extended
{
  provider: "github",
  access_token: "gho_xxx",     // User OAuth token
  scope: "user:email gist",
  // NEW: Installation data
  installation_id: 12345678,
  installation_access_token: "ghs_xxx",  // Short-lived, auto-refreshed
  installation_expires_at: "2026-02-02T12:00:00Z",
  selected_repos: ["owner/repo1", "owner/repo2"],
}

// OR separate table for installations
// app.github_installations
{
  user_id: "uuid",
  installation_id: 12345678,
  repos: ["owner/repo1", "owner/repo2"],
  created_at: timestamp,
}
```

---

## UI Design

### Settings Page: GitHub Integration Card

```
┌────────────────────────────────────────────────────────────────┐
│ 🐙 GitHub                                              [Beta]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ● Account Connected                                            │
│   Connected as @eenlars                       [Disconnect]     │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ○ Repository Access                                            │
│   No repositories authorized yet                               │
│                                                                │
│   [Authorize Repositories]                                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

After authorizing repositories:

```
┌────────────────────────────────────────────────────────────────┐
│ 🐙 GitHub                                              [Beta]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ● Account Connected                                            │
│   Connected as @eenlars                       [Disconnect]     │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ● Repository Access (3 repositories)                           │
│                                                                │
│   ├─ eenlars/my-website               [✓]                      │
│   ├─ eenlars/portfolio                [✓]                      │
│   └─ eenlars/api-server               [✓]                      │
│                                                                │
│   [Add Repositories]  [Manage on GitHub ↗]                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Model Changes

### Option A: Extend Lockbox Metadata

Store installation data in oauth-core's existing metadata field:

```typescript
// packages/oauth-core/src/types.ts
interface GitHubOAuthMetadata {
  username: string
  email?: string
  installation_id?: number
  installation_access_token?: string
  installation_expires_at?: string
  selected_repos?: string[]
}
```

**Pros:** No schema changes, fits existing pattern
**Cons:** Metadata field gets complex, harder to query repos

### Option B: Separate Installations Table (Recommended)

New table for GitHub App installations:

```sql
-- Migration: 20260202_github_installations.sql
CREATE TABLE app.github_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('user', 'organization')),
  account_login TEXT NOT NULL,
  account_avatar_url TEXT,
  -- Cached list of repos (updated on webhook or manual refresh)
  repos JSONB DEFAULT '[]'::jsonb,
  -- Permissions granted
  permissions JSONB DEFAULT '{}'::jsonb,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ
);

CREATE INDEX idx_github_installations_user ON app.github_installations(user_id);
CREATE INDEX idx_github_installations_account ON app.github_installations(account_login);
```

**Pros:** Clean separation, queryable, supports multiple installations
**Cons:** Extra table, needs migration

**Recommendation:** Option B - installations are a distinct concept from OAuth tokens

---

## API Routes

### Stage 1: Account Authorization

| Route | Method | Description |
|-------|--------|-------------|
| `GET /api/auth/github` | GET | Existing OAuth flow - redirects to GitHub |
| `GET /api/auth/github/callback` | GET | Existing callback - stores user token |

No changes needed for Stage 1 - existing flow works.

### Stage 2: Repository Authorization

| Route | Method | Description |
|-------|--------|-------------|
| `GET /api/auth/github/install` | GET | Redirect to GitHub App installation |
| `GET /api/auth/github/install/callback` | GET | Handle installation callback |
| `GET /api/github/installations` | GET | List user's installations |
| `GET /api/github/installations/:id/repos` | GET | List repos for installation |
| `POST /api/github/installations/:id/sync` | POST | Refresh repo list from GitHub |
| `DELETE /api/github/installations/:id` | DELETE | Remove installation (uninstall app) |

### Install Route

```typescript
// apps/web/app/api/auth/github/install/route.ts
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  // Verify user has completed Stage 1 (account auth)
  const oauthManager = getOAuthInstance('github')
  const isConnected = await oauthManager.isConnected(user.id, 'github')
  if (!isConnected) {
    return redirect('/settings?error=github_account_required')
  }

  // Build state with user ID for callback
  const state = encodeState({ userId: user.id, returnUrl: req.nextUrl.searchParams.get('returnUrl') })

  // Redirect to GitHub App installation
  const installUrl = new URL('https://github.com/apps/goalive/installations/new')
  installUrl.searchParams.set('state', state)

  return redirect(installUrl.toString())
}
```

### Install Callback Route

```typescript
// apps/web/app/api/auth/github/install/callback/route.ts
export async function GET(req: NextRequest) {
  const installationId = req.nextUrl.searchParams.get('installation_id')
  const state = req.nextUrl.searchParams.get('state')
  const setupAction = req.nextUrl.searchParams.get('setup_action') // 'install' | 'update' | 'request'

  if (!installationId || !state) {
    return redirect('/settings?error=missing_params')
  }

  const { userId, returnUrl } = decodeState(state)

  // Get installation details from GitHub API
  const app = createGitHubApp()
  const octokit = app.getInstallationOctokit(parseInt(installationId))
  const { data: installation } = await octokit.apps.getInstallation({
    installation_id: parseInt(installationId)
  })

  // Get repos accessible to this installation
  const { data: repos } = await octokit.apps.listReposAccessibleToInstallation({
    installation_id: parseInt(installationId)
  })

  // Store installation
  await supabase.from('github_installations').upsert({
    user_id: userId,
    installation_id: parseInt(installationId),
    account_type: installation.account.type,
    account_login: installation.account.login,
    account_avatar_url: installation.account.avatar_url,
    repos: repos.repositories.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private: r.private,
    })),
    permissions: installation.permissions,
    last_sync_at: new Date().toISOString(),
  }, { onConflict: 'installation_id' })

  return redirect(returnUrl || '/settings?github=repos_connected')
}
```

---

## Frontend Components

### New Components

```
apps/web/components/integrations/github/
├── GitHubAccountStatus.tsx      # Shows account connection status
├── GitHubRepoAccess.tsx         # Shows repo authorization status
├── GitHubRepoList.tsx           # Lists authorized repos
├── GitHubInstallButton.tsx      # "Authorize Repositories" button
└── GitHubIntegrationCard.tsx    # Combines all above (for Settings)
```

### GitHubIntegrationCard.tsx

```tsx
export function GitHubIntegrationCard() {
  const { accountStatus, installations, loading } = useGitHubStatus()

  if (loading) return <Skeleton />

  return (
    <Card>
      <CardHeader>
        <GitHubLogo />
        <CardTitle>GitHub</CardTitle>
      </CardHeader>

      <CardContent>
        {/* Stage 1: Account */}
        <GitHubAccountStatus status={accountStatus} />

        {/* Divider */}
        <Separator />

        {/* Stage 2: Repositories */}
        {accountStatus.connected ? (
          <GitHubRepoAccess installations={installations} />
        ) : (
          <p className="text-muted-foreground">
            Connect your account first to authorize repositories
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### Hook: useGitHubStatus

```typescript
// apps/web/hooks/use-github-status.ts
export function useGitHubStatus() {
  const { data: accountData } = useSWR('/api/integrations/github/status')
  const { data: installationsData } = useSWR(
    accountData?.connected ? '/api/github/installations' : null
  )

  return {
    accountStatus: {
      connected: accountData?.connected ?? false,
      username: accountData?.username,
      email: accountData?.email,
    },
    installations: installationsData?.installations ?? [],
    loading: !accountData,
  }
}
```

---

## GitHub App Configuration

### App Settings (github.com/settings/apps)

| Setting | Value |
|---------|-------|
| GitHub App name | `GoAlive` (or `Manus Connector` style) |
| Homepage URL | `https://goalive.nl` |
| Callback URL | `https://terminal.goalive.nl/api/auth/github` |
| Setup URL | `https://terminal.goalive.nl/api/auth/github/install/callback` |
| Post installation | Redirect to setup URL |
| Webhook | Disabled (or enabled for repo events) |

### Permissions

**Repository permissions:**
| Permission | Access | Why |
|------------|--------|-----|
| Metadata | Read | Required for all apps |
| Contents | Read & Write | Push code, read files |
| Issues | Read & Write | Create/manage issues |
| Pull requests | Read & Write | Create/manage PRs |
| Administration | Read & Write | Repo settings (optional) |
| Environments | Read & Write | Deployment environments (optional) |

**User permissions (requested during OAuth, not installation):**
| Permission | Access | Why |
|------------|--------|-----|
| Email addresses | Read | Identify user |
| Gists | Read & Write | Share code snippets (optional) |

---

## Migration Plan

### Phase 1: Backend Infrastructure

1. Create `app.github_installations` table
2. Add `/api/auth/github/install` route
3. Add `/api/auth/github/install/callback` route
4. Add `/api/github/installations` routes
5. Create GitHub App client utilities

### Phase 2: Frontend UI

1. Create `GitHubIntegrationCard` component
2. Create `GitHubAccountStatus` component
3. Create `GitHubRepoAccess` component
4. Update integration registry to use new card
5. Add `useGitHubStatus` hook

### Phase 3: Testing & Polish

1. E2E tests for both flows
2. Error handling (user cancels, rate limits)
3. Edge cases (multiple installations, org vs user)
4. Loading states and animations

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Token exposure | Encrypt in lockbox, never log |
| Installation hijacking | Verify `state` parameter contains user ID |
| Over-permission | Only request needed permissions |
| Long-lived tokens | Use installation tokens (1hr expiry) |
| Webhook spoofing | Validate webhook signatures (if enabled) |

---

## Testing Plan

### AI Tests (Automated)

```typescript
// Stage 1: Account OAuth
describe('GitHub Account OAuth', () => {
  it('redirects to GitHub authorization URL')
  it('handles callback and stores token')
  it('returns connection status')
})

// Stage 2: Repository Installation
describe('GitHub App Installation', () => {
  it('requires account connection first')
  it('redirects to GitHub App installation page')
  it('handles installation callback')
  it('stores installation with repos')
  it('lists user installations')
  it('syncs repo list from GitHub')
})
```

### Human Tests (Manual)

1. Go to Settings
2. See "GitHub" with "Connect" button
3. Click Connect → GitHub OAuth screen
4. Authorize → back to Settings
5. See "Connected as @username"
6. See "Authorize Repositories" button
7. Click → GitHub App installation screen
8. Select repos → back to Settings
9. See repo list with checkmarks
10. Click "Manage on GitHub" → opens GitHub settings

---

## Open Questions

1. **Multiple installations?** Can a user have GitHub App installed on multiple accounts (personal + orgs)?
   - Yes, we should support this with a list of installations

2. **Webhook integration?** Should we listen for installation events?
   - Optional for v1, useful for real-time repo list updates

3. **Revocation?** What happens when user uninstalls app on GitHub?
   - We should handle gracefully, show "reconnect" state

4. **Org permissions?** If installed on org, who can use it?
   - Track org membership separately, or just allow all org members

---

## Dependencies

```bash
# Already installed
@octokit/app
@octokit/rest

# No new deps needed
```

---

## Definition of Done

- [ ] GitHub App configured with 2-stage permissions
- [ ] Stage 1: OAuth flow works (account connection)
- [ ] Stage 2: Installation flow works (repo access)
- [ ] UI shows both stages clearly
- [ ] User can add/manage repositories
- [ ] Installation stored in database
- [ ] All tests pass
- [ ] No tokens logged
- [ ] Works with both personal accounts and organizations
