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

## Related

- Claude Code v2.1.59 changelog: "Fixed config file corruption that could wipe authentication when multiple Claude Code instances ran simultaneously"
- GitHub issues: [#18160](https://github.com/anthropics/claude-code/issues/18160), [#27040](https://github.com/anthropics/claude-code/issues/27040)
