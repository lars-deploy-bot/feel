# Expert Review Request: GitHub Git Integration RFC

You are a senior engineer who has built GitHub integrations at scale (Vercel, Netlify, or similar). You've seen what works and what breaks. Be critical. Tell us what's wrong before we build it.

## What We're Building

**GoAlive** is a web platform where non-technical users build websites by chatting with Claude AI. Each user gets an isolated workspace (`/srv/webalive/sites/[domain]/`) with their site files. We want to add GitHub backup so users don't lose work and can eventually collaborate.

**What exists today:**
- `packages/oauth-core/` - AES-256-GCM encrypted token storage, already works for Linear integration
- `apps/web/components/settings/integrations-list.tsx` - UI for connecting/disconnecting integrations
- `packages/oauth-core/src/providers/github.ts` - GitHub OAuth provider (but we're switching to GitHub App)
- Workspace isolation via `lib/workspace-execution/runAsWorkspaceUser()` - runs commands as site user

**What we're adding:**
- GitHub App authentication (not OAuth App) for fine-grained repo access
- Auto-create repo when user connects (e.g., `username/mysite-alive-best`)
- Branch indicator in header: `main ✓` (synced) or `main •` (uncommitted changes)
- One-click "Sync" button that does `git add -A && git commit -m "Update from GoAlive" && git push`
- Option to switch to user's own repo later

## The RFC

Full spec: `/docs/prs/github-git-integration.md`

**User flow:**
1. User sees prompt: "Back up your work to GitHub" (like our photo upload prompts)
2. Clicks → GitHub App installation flow
3. We create repo automatically, do initial commit + push
4. Header shows `main ✓`
5. After changes, shows `main •` - user clicks → Sync → back to `main ✓`

**Key decisions:**
| Decision | Choice | Reasoning |
|----------|--------|-----------|
| GitHub App vs OAuth App | GitHub App | Short-lived tokens, user picks which repos |
| Repo creation | Auto-create in user's account | Reduce friction for non-technical users |
| Commit messages | Auto-generate "Update from GoAlive" | Users won't write good messages anyway |
| Conflicts | Not handled yet | Open question |
| Branches | Single branch (main) | Keep it simple |

**Implementation plan:**
- Phase 1: GitHub App auth routes (`app/api/auth/github/`) - 3h
- Phase 2: Auto-create repo + git operations (`lib/github/repo-manager.ts`) - 4h
- Phase 3: Frontend components (`components/git/BranchIndicator.tsx`, `SyncPanel.tsx`) - 6h
- Phase 4: Tests - 2h

## What We Need You To Break

### 1. GitHub App complexity
We chose GitHub App over OAuth App for security. But GitHub App requires:
- Private key management (`GITHUB_PRIVATE_KEY` env var, multiline PEM)
- Installation ID tracking per user
- Token refresh logic (1-hour expiry)

OAuth App would be: user authorizes once, we store token, done.

**Is the security benefit worth the complexity for a backup feature?**

### 2. Auto-creating repos
We want to create repos in the user's GitHub account. But:
- What if `mysite-alive-best` repo already exists?
- Do we need `repo` scope or can we use more limited permissions?
- Should we create under a GoAlive org instead (`goalive-backups/user-site`)?

**What breaks here?**

### 3. Sync conflicts
Current plan: `git add -A && git commit && git push`

What if user edited files on GitHub.com directly? Push will fail. Options:
- A) Always force push (lose their GitHub edits)
- B) Pull first, but then we need conflict resolution UI
- C) Fail and show error "Please sync from GitHub first"

Our users are non-technical. They won't understand merge conflicts.

**What would Vercel/Netlify do here?**

### 4. Git on server vs GitHub API
We run actual `git` commands via `runAsWorkspaceUser()`. Alternative: use GitHub Contents API to upload files directly.

Tradeoffs:
- `git push`: Familiar, handles binary files, but need git installed, auth via credential helper
- GitHub API: No git needed, but 100MB limit, rate limits, different mental model

**Which would you use?**

### 5. What are we missing?
- Large file handling? (media assets)
- Rate limits? (GitHub API: 5000/hr for apps)
- Private vs public repos?
- `.gitignore` - should we auto-create one? (exclude `node_modules`, `.env`)
- Repo size limits?

**What will bite us in production?**

### 6. Should we even build this?
Alternatives:
- Simple "Download as ZIP" button
- Our own S3 backup (invisible to user)
- Just auto-save to our DB

**Is GitHub integration overkill for "backup your work"?**

## Your Task

1. Read the RFC at `/docs/prs/github-git-integration.md`
2. Identify the 3 biggest problems with our approach
3. For each problem: what would break, and what should we do instead
4. Tell us if we should build this at all, or do something simpler

Be harsh. We want to know what's wrong now, not after we ship.
