# Phase 6: Repo Creation

**Time:** 3 hours
**Depends on:** Phase 5
**Deliverable:** Auto-create GitHub repo on connect

---

## Goal

When user connects GitHub, automatically create a repository and push initial commit. User sees repo link in Settings.

**Security:** All operations require BOTH admin site AND admin user (inherited from Phase 5 callback).

---

## Files to Create/Modify

### 1. Repo Operations

```typescript
// apps/web/lib/github/repo-operations.ts
import { getInstallationOctokit } from './app-client';

function domainToRepoName(domain: string): string {
  return domain.replace(/\./g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
}

export async function createRepository(
  installationId: number,
  domain: string
): Promise<{ owner: string; name: string; url: string; cloneUrl: string }> {
  const octokit = await getInstallationOctokit(installationId);
  const repoName = domainToRepoName(domain);

  const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
    name: repoName,
    description: `Website source for ${domain}`,
    private: true,
    auto_init: false,
  });

  return {
    owner: repo.owner.login,
    name: repo.name,
    url: repo.html_url,
    cloneUrl: repo.clone_url,
  };
}
```

### 2. Git Init Operations

```typescript
// apps/web/lib/github/git-init.ts
import { runAsWorkspaceUser } from '@/lib/workspace-execution/command-runner';
import { getWorkspacePath } from '@/lib/workspace';
import fs from 'fs/promises';

async function git(args: string[], workspacePath: string, token?: string): Promise<string> {
  const env: Record<string, string> = { GIT_TERMINAL_PROMPT: '0' };

  const result = await runAsWorkspaceUser({
    workspacePath,
    command: 'git',
    args,
    env,
    stdin: token ? `protocol=https\nhost=github.com\nusername=x-access-token\npassword=${token}\n\n` : undefined,
  });

  if (result.exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export async function initializeRepo(
  domain: string,
  repoUrl: string,
  token: string
): Promise<string> {
  const workspacePath = getWorkspacePath(domain);

  // Check if already a git repo
  try {
    await git(['rev-parse', '--git-dir'], workspacePath);
    // Already initialized, just add remote
  } catch {
    await git(['init'], workspacePath);
    await git(['config', 'user.email', 'goalive@goalive.nl'], workspacePath);
    await git(['config', 'user.name', 'GoAlive'], workspacePath);
  }

  // Create .gitignore if missing
  const gitignorePath = `${workspacePath}/.gitignore`;
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, 'node_modules/\n.bun/\n.env\n.env.local\n*.log\n.DS_Store\n');
  }

  // Add remote
  try {
    await git(['remote', 'add', 'origin', repoUrl], workspacePath);
  } catch {
    await git(['remote', 'set-url', 'origin', repoUrl], workspacePath);
  }

  // Add all files
  await git(['add', '-A'], workspacePath);

  // Commit
  try {
    await git(['commit', '-m', 'Initial commit from GoAlive'], workspacePath);
  } catch {
    // No changes to commit - that's fine
  }

  // Ensure main branch
  try {
    await git(['branch', '-M', 'main'], workspacePath);
  } catch {
    // Already on main
  }

  // Push
  await git(['push', '-u', 'origin', 'main'], workspacePath, token);

  // Return commit hash
  return git(['rev-parse', 'HEAD'], workspacePath);
}
```

### 3. Update Callback (Create Repo)

```typescript
// apps/web/app/api/auth/github/callback/route.ts (update)
import { createRepository } from '@/lib/github/repo-operations';
import { initializeRepo } from '@/lib/github/git-init';

// After storing token, add:
try {
  // Create repo
  const repo = await createRepository(
    parseInt(installationId, 10),
    state.workspace
  );

  // Initialize and push
  const commitHash = await initializeRepo(
    state.workspace,
    repo.cloneUrl,
    authentication.token
  );

  // Update config with repo info
  await supabaseAdmin
    .from('workspace_git_config')
    .update({
      repo_owner: repo.owner,
      repo_name: repo.name,
      last_synced_at: new Date().toISOString(),
      last_synced_commit: commitHash,
    })
    .eq('workspace_domain', state.workspace);

} catch (error) {
  console.error('Repo creation error:', error);
  // Don't fail OAuth - user is connected, repo can be retried
}
```

---

## AI Tests

```bash
# After OAuth flow completes, check database
psql -c "SELECT repo_owner, repo_name, last_synced_commit FROM app.workspace_git_config WHERE workspace_domain='huurmatcher.alive.best'"
# Expected: repo_owner and repo_name populated

# Verify repo exists on GitHub
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/demo-user/huurmatcher-alive-best"
# Expected: 200 OK with repo info

# Verify workspace has .git
ls -la /srv/webalive/sites/huurmatcher.alive.best/.git
# Expected: .git directory exists
```

```typescript
// apps/web/lib/github/__tests__/repo-operations.test.ts
import { describe, it, expect } from 'vitest';

describe('domainToRepoName', () => {
  it('converts domain to valid repo name', () => {
    expect(domainToRepoName('huurmatcher.alive.best')).toBe('huurmatcher-alive-best');
  });

  it('removes invalid characters', () => {
    expect(domainToRepoName('my_site!.com')).toBe('mysite-com');
  });
});
```

---

## Human Tests

1. Disconnect GitHub (if connected)
2. Click "Connect GitHub"
3. Complete OAuth
4. **Verify:** Settings shows repo link
5. Click repo link
6. **Verify:** Opens GitHub, repo exists
7. **Verify:** Repo has initial commit with workspace files
8. **Verify:** Repo is private
9. Go back to workspace, make a change to any file
10. (Sync will be tested in Phase 7)

---

## Definition of Done

- [ ] `repo-operations.ts` creates GitHub repo
- [ ] `git-init.ts` initializes workspace git
- [ ] Callback creates repo on connect
- [ ] Repo name derived from domain
- [ ] Initial commit pushed
- [ ] Repo link shown in Settings
- [ ] Repo exists on GitHub
- [ ] Repo is private
- [ ] workspace_git_config has repo info
