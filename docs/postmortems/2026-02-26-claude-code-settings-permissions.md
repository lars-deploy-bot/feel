# Postmortem: 2026-02-26 Claude Code Settings Permissions Break CLI + User Sessions

## Summary

After upgrading Claude Code CLI to v2.1.59, both the local CLI and all platform user sessions broke simultaneously. Two distinct issues stacked on top of each other:

1. **CLI settings ignored**: `.claude/settings.local.json` shadowed `~/.claude/settings.json` via whole-file replacement (not deep merge), silently dropping `permissions.allow` and `alwaysThinkingEnabled`.
2. **User sessions returned 0 messages**: Changing `~/.claude/settings.json` permissions from `645` to `600` locked out worker subprocesses that run as non-root users after privilege drop.

## Impact

- **CLI**: All permission allow-rules and extended thinking stopped working for the developer
- **Platform users**: ~65% of queries in the last hour returned 0 messages (15 empty vs 8 successful). Users saw no response from Claude — messages appeared "swallowed"
- **Duration**: ~2 hours from upgrade to full fix
- **Started**: 2026-02-26 ~08:43 UTC (when 2.1.59 binary was downloaded)
- **Zero 0-message queries** in the 24 hours prior — confirmed via `journalctl`

## Timeline

1. **08:43** — Claude Code auto-updates to v2.1.59
2. **~09:00** — Developer notices CLI settings not working (permissions prompting, no extended thinking)
3. **~10:00** — Investigation: config files had unusual permission bits (`645`, `667`)
4. **~10:30** — "Fix" applied: `chmod 600` on `settings.json` and `.claude.json`
5. **~10:45** — CLI still broken. Discovered `.claude/settings.local.json` was shadowing global settings
6. **~11:00** — Consolidated all settings into `.claude/settings.local.json`, CLI fixed
7. **~11:00** — Rolled back to 2.1.58 binary (red herring — wasn't the CLI issue)
8. **~11:13** — Rolled forward to 2.1.59 binary, CLI confirmed working
9. **~11:30** — Discovered platform user sessions returning 0 messages since this morning
10. **~11:35** — Root cause: `chmod 600` made config unreadable by workspace users after privilege drop
11. **~11:35** — Fix: `chmod 644` on both files. User sessions immediately recovered

## Root Cause

### Issue 1: CLI Settings Shadowed

The project had two settings files:

| Priority | File | Content |
|----------|------|---------|
| **Higher** | `/root/webalive/alive/.claude/settings.local.json` | `enabledMcpjsonServers` only |
| **Lower** | `~/.claude/settings.json` | `permissions.allow` + `alwaysThinkingEnabled` |

Claude Code uses **whole-file replacement**, not per-key deep merge. When the local file exists, it wins entirely — keys not present in the local file are not inherited from the global file. This silently dropped all permission rules and thinking config.

### Issue 2: Worker Subprocess Permissions

The platform architecture:
```
Web request → Worker (starts as root) → drops privileges to site-example-com (uid 993)
                                       → spawns Claude CLI subprocess (inherits dropped uid)
                                       → subprocess reads CLAUDE_CONFIG_DIR=/root/.claude/
```

The `chmod 600` fix made `settings.json` owner-read-only (`-rw-------`). The dropped-privilege subprocess (running as `site-example-com`, not root) could no longer read the file. The Claude CLI subprocess exited silently with 0 messages instead of erroring.

The original `645` permissions (`-rw-r--r-x`) happened to work because the world-readable bit was set. `644` (`-rw-r--r--`) is the correct permission — root writes, everyone reads.

## Fix

### CLI (permanent)
All settings consolidated into one file:
```json
// /root/webalive/alive/.claude/settings.local.json
{
  "permissions": {
    "allow": [
      "Bash(*)", "Read(*)", "Write(*)", "Edit(*)",
      "Glob(*)", "Grep(*)", "WebFetch(*)", "WebSearch(*)",
      "NotebookEdit(*)", "Task(*)",
      "mcp__playwright", "mcp__context7", "mcp__supabase"
    ]
  },
  "alwaysThinkingEnabled": true,
  "enabledMcpjsonServers": ["supabase", "playwright"]
}
```

### User sessions (permanent)
```bash
chmod 644 /root/.claude/settings.json /root/.claude/.claude.json
```

## Lessons Learned

1. **Settings merge is whole-file, not deep**: If a project-level `settings.local.json` exists, it replaces global settings entirely. Don't split settings across files expecting them to merge.

2. **`chmod 600` is wrong for shared config**: When workers drop privileges, their subprocesses need to read `CLAUDE_CONFIG_DIR`. Use `644` (world-readable) not `600` (owner-only).

3. **"Fix the permissions" can make things worse**: The original `645`/`667` permissions looked wrong but worked. "Fixing" them to `600` broke user sessions. Always consider who else reads these files before tightening permissions.

4. **0-message queries = silent failure**: The Claude CLI subprocess exits cleanly (code 0) when it can't read config, producing zero messages. There's no error logged. This makes the failure invisible without checking message counts.

5. **Check `journalctl` message counts**: `grep "Query complete: 0 messages"` is a quick way to detect this class of failure.

## Detection

Add monitoring for 0-message query rate:
```bash
# Alert if >10% of queries return 0 messages in last 15 min
journalctl -u alive-production --since "15 min ago" --no-pager | grep "Query complete: 0 messages" | wc -l
```

## Addendum: 2026-03-14 Docker Staging "0 Messages" Incident

This was a separate incident with the same user-visible symptom: Claude appeared to "swallow" prompts and the worker emitted `0 messages`. The root cause was different from the 2026-02-26 permissions break.

### Summary

The Docker staging worker pool went through three phases:

1. **CLI startup was blocked in Docker** by container/runtime configuration issues.
2. **Worker boot then failed under Node** because of a Node-only ESM import bug (`deploy.generated` missing `.js`).
3. **After the worker finally booted, queries still returned 0 messages** because the worker dropped UID/GID without resetting supplementary groups first.

### Exact Timeline

1. **2026-03-14 01:00:22 +01:00** — Commit `59d22ed0d4880209fcd1e87eea11b68844f5bad9` (`Run Docker container with bun instead of node`)
   - Changed the Docker runtime assumptions around the control-plane container.
   - This was not the final fix, but it shaped the later debugging path by changing how the server and workers inherited their runtime.

2. **2026-03-14 01:44:54 +01:00** — Commit `b10459719af0eadbdda9792653062f752bb00360` (`Make /root/.local read-write for Claude CLI`)
   - Fixed a real Docker-only startup blocker for the Claude CLI.
   - This was the first genuine breakthrough: the CLI install/runtime area under `/root/.local` was no longer read-only.
   - Important nuance: this only made the CLI more launchable. It did **not** fix the full worker-pool query path.

3. **2026-03-14 01:59:25 +01:00** — Commit `6163807384efc2deae7bbce1295cc511bbc543c8` (`Remove CLAUDECODE=1 — it prevents the CLI from starting`)
   - Removed a bad attempted fix.
   - `CLAUDECODE=1` caused Docker staging to look like a nested Claude Code session, producing:
     - `Error: Claude Code cannot be launched inside another Claude Code session.`
   - This clarified that the nested-session guard was a red herring introduced during investigation, not the original production failure.

4. **~02:00-03:30 +01:00** — Worker boot failures were isolated more precisely
   - Once the CLI could start, staging still failed before `ready` on some builds.
   - Reproduction showed Node worker boot was failing with:
     - `ERR_MODULE_NOT_FOUND: Cannot find module ... /packages/database/dist/deploy.generated`
   - Root cause: `packages/database/src/deploy-enums.ts` used `./deploy.generated` without the `.js` extension, which Bun tolerated and Node did not.
   - This created a second-stage failure mode: the worker could crash before becoming ready even after the original CLI startup issues were improved.

5. **~02:50 +01:00** — Deployment gate exposed an unrelated environment prerequisite
   - Staging deploy completed health checks but failed post-deploy E2E because Playwright browsers were missing:
     - `PLAYWRIGHT_BROWSERS_PATH does not exist: /root/.cache/ms-playwright`
   - The fix was to:
     - add an explicit Playwright browser verifier,
     - fail this in preflight instead of post-deploy,
     - move the browser cache to a controlled repo-local path,
     - install Chromium there.
   - This was operational noise, not the Claude stream root cause, but it blocked clean verification.

6. **~03:15-03:30 +01:00** — Final root cause isolated by direct repro matrix
   - A fresh process started directly as the site user succeeded.
   - A root `node` process that only did `setgid/setuid` and then ran the exact same SDK query returned:
     - `0 messages`
     - `no stderr`
   - The same root process succeeded immediately once it also ran:
     - `setgroups([targetGid])`
     - before `setgid(targetGid)` and `setuid(targetUid)`.
   - This proved the real end-to-end failure was **not** MCP, OAuth, model choice, or tool registry config. It was incomplete privilege dropping.

7. **2026-03-14 04:00:53 +01:00** — Commit `6e1b456d7440d0e184622845cbfb3d3aefc5ed8e` (`finally`)
   - Landed the full stabilization set:
     - worker/query diagnostics for missing terminal results,
     - Node-compatible `deploy.generated.js` import,
     - better worker boot error surfacing,
     - Playwright browser preflight verification,
     - and the actual privilege-drop fix:
       - reset supplementary groups before `setgid/setuid`.
   - This was the first commit that plausibly turned staging from "partially alive" into "working end-to-end".

### Final Root Cause

The worker process started as root and dropped to the workspace user with `setgid/setuid`, but **did not reset supplementary groups first**. In Docker staging, that left the process in a bad post-drop state where Claude SDK queries could terminate with `0 messages` and no stderr even though:

- the worker booted successfully,
- the OAuth token was valid,
- the same SDK payload worked in a fresh site-user process,
- and MCP/server/tool configuration was otherwise correct.

The permanent code fix was to reset supplementary groups before dropping GID/UID:

```js
process.setgroups([targetGid])
process.setgid(targetGid)
process.setuid(targetUid)
```

### What Was Signal vs Noise

Real blockers:

1. `/root/.local` Docker mount behavior affected CLI startup.
2. `CLAUDECODE=1` incorrectly triggered nested-session refusal.
3. Missing `.js` extension in `deploy-enums.ts` broke Node worker boot.
4. Missing `setgroups([targetGid])` caused the final silent `0 messages` worker-query failure.

Noise or secondary effects:

1. MCP suspicion was reasonable but not the final cause.
2. `server-config.json` readability mattered for a future "spawn-as-user" design, but it was not the final root cause of this incident.
3. Playwright browser cache misconfiguration blocked deployment verification, but it was not related to Claude stream execution.

### Lessons From The Addendum

1. **"0 messages" is a symptom class, not a single bug**: the same visible failure can come from permissions, runtime boot issues, or privilege-drop state corruption.
2. **Privilege dropping is not complete at `setuid/setgid`**: supplementary groups must be reset explicitly.
3. **Direct repro matrices beat speculation**: the decisive proof came from comparing:
   - direct site-user process,
   - root process with `setgid/setuid`,
   - root process with `setgroups` + `setgid/setuid`.
4. **Node vs Bun differences must be tested against the built artifact**: extensionless ESM imports can hide under Bun and only fail once a worker path runs under Node.
5. **Deployment verification needs preflighted prerequisites**: browser cache presence must fail before deploy, not after health checks.

## Related

- Claude Code v2.1.59 changelog: "Fixed config file corruption that could wipe authentication when multiple Claude Code instances ran simultaneously"
- GitHub issues: [#18160](https://github.com/anthropics/claude-code/issues/18160), [#27040](https://github.com/anthropics/claude-code/issues/27040)
