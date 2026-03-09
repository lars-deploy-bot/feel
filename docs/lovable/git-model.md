# Git Model

## Remotes

- **Primary**: `lovable.code.storage/{project-id}.git` (JWT-authed HTTPS). **Git JWT uses ES256** (not RS256 like claim JWT), with scopes `["git:read", "git:write"]`, issuer `lovable`, subject `lovable-api`, ~30-day expiry.
- **Secondary**: `s3://lovable-repositories/{project-id}.git` (backup). Uses `git_remote_s3` helper — creates temp dirs `/tmp/git_remote_s3_push_*`.

## Branching & Merge Model

- ~20 local `edit/edt-{uuid}` branches — one per agent edit session.
- Edits happen on branches, then get **reset-merged** to main (`Reset to {sha}` in reflog). Not traditional merge commits.
- **Single-writer**: One agent per sandbox, no concurrent edit protection visible.
- The user sees clean history. The actual history is hundreds of tiny single-file commits, squashed away. You can never `git bisect` to find which agent action broke something.

## Worktree Layout

```text
/git/pool.git           # Pre-claim bare repo with alternates (object deduplication)
/git/repo.git           # Main bare repo after claim
/dev-server/.git        # gitdir pointer → /git/repo.git/worktrees/dev-server
```

## Write Path

1. Every commit authored by `gpt-engineer-app[bot]` / `159125892+gpt-engineer-app[bot]@users.noreply.github.com`
2. Commits are single-file in many cases
3. Working tree always clean after commits
4. No batch commits — write → commit → write next → commit

## Git Config

- `GIT_CONFIG_NOSYSTEM=1`, `commit.gpgsign=false`
- Transfer settings: `http.lowspeedlimit=1000`, `http.lowspeedtime=15`

## Git HTTP Backend

The `/_sandbox/git/*` route uses standard `git http-backend` CGI:
- `REMOTE_USER=lovable`
- `REMOTE_ADDR=lovable.dev`
- Supports `http.uploadpack`, `http.getanyfile`, `http.uploadarchive`
- This is how external services (the orchestrator) interact with the sandbox's git repo over HTTP.

## Not-Fast-Forward Handling

Precondition check via `expect_head` in `StartDeploymentRequest` — if HEAD has moved since deploy was queued, the deploy fails gracefully instead of force-pushing.

## Submodule & Partial Checkout

- `.gitmodules` checked during deployment validation.
- Submodule initialization support present.
- Partial checkout capabilities referenced in binary strings.
