# Anthropic OAuth — Single Source of Truth

> **DO NOT DELETE THIS FILE.** All OAuth-related code references this document.
> If you change OAuth behavior, update this file FIRST, then update the code.

## Why This File Exists

Multiple processes on this server read and write the same OAuth credentials file. If they don't coordinate perfectly, the rotating refresh token gets consumed by one process and every other process breaks with `invalid_grant`. This has caused production outages.

This document is the authoritative reference for:
1. How Anthropic OAuth tokens work
2. How Claude Code CLI manages them (reverse-engineered from the binary)
3. How our web app coordinates with the CLI
4. How worker processes consume tokens
5. How to diagnose and fix OAuth failures

**Every file that touches OAuth MUST reference this doc.** No exceptions.

---

## Table of Contents

- [1. The Credential File](#1-the-credential-file)
- [2. Token Lifecycle](#2-token-lifecycle)
- [3. Refresh Token Rotation (The Dangerous Part)](#3-refresh-token-rotation-the-dangerous-part)
- [4. Claude Code CLI Internals (Reverse-Engineered)](#4-claude-code-cli-internals-reverse-engineered)
- [5. Our Web App: anthropic-oauth.ts](#5-our-web-app-anthropic-oauthts)
- [6. Token Flow Through the System](#6-token-flow-through-the-system)
- [7. The Lock Contract](#7-the-lock-contract)
- [8. Consumers (Who Reads the Token)](#8-consumers-who-reads-the-token)
- [9. Failure Modes and Diagnosis](#9-failure-modes-and-diagnosis)
- [10. Recovery Procedures](#10-recovery-procedures)
- [11. Verification Commands](#11-verification-commands)
- [12. Re-verification When CLI Updates](#12-re-verification-when-cli-updates)
- [13. File Index](#13-file-index)

---

## 1. The Credential File

**Path:** `~/.claude/.credentials.json`
**Permissions:** `0o644` in production (workers need read access after UID drop)
**Owner:** `root:root`

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "refreshToken": "sk-ant-ort01-...",
    "expiresAt": 1771898135566,
    "scopes": ["user:inference", "user:mcp_servers", "user:profile", "user:sessions:claude_code"],
    "subscriptionType": "max",
    "rateLimitTier": "default_claude_max_20x"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | string | Bearer token for Anthropic API. Prefix: `sk-ant-oat01-` |
| `refreshToken` | string | One-time-use token to get a new access token. Prefix: `sk-ant-ort01-` |
| `expiresAt` | number | Unix milliseconds when `accessToken` expires |
| `scopes` | string[] | OAuth scopes granted |
| `subscriptionType` | string | `"max"`, `"pro"`, etc. |
| `rateLimitTier` | string | Rate limit tier for this subscription |

**Key facts:**
- `expiresAt` = `Date.now() + expires_in * 1000`
- `expires_in` from Anthropic = **28800 seconds (8 hours)**
- CLI checks expiry with a **5-minute buffer** (refresh ~5 min early)
- Web app request path checks with a **5-minute buffer**, plus a proactive heartbeat that keeps at least **2 hours** of validity

---

## 2. Token Lifecycle

```text
/login (browser OAuth flow)
    │
    ▼
CLI writes .credentials.json with fresh accessToken + refreshToken
    │
    ▼
Token valid for 8 hours
    │
    ▼
Background heartbeat checks every 15m; if <2h left, web app refreshes early
    │
    ▼
At ~7h55m, next request triggers refresh (5-min buffer)
    │
    ▼
POST https://console.anthropic.com/v1/oauth/token
  body: { grant_type: "refresh_token", client_id: "...", refresh_token: "..." }
    │
    ▼
Anthropic returns: { access_token, refresh_token (NEW!), expires_in: 28800 }
    │
    ▼
Old refresh token is PERMANENTLY DEAD
New tokens written to .credentials.json
    │
    ▼
Cycle repeats indefinitely (until refresh token is revoked or lost)
```

---

## 3. Refresh Token Rotation (The Dangerous Part)

**Anthropic uses rotating refresh tokens.** This is the root cause of every OAuth outage we've had.

**How it works:**
- Each refresh request **consumes** the current refresh token
- The response includes a **new** refresh token
- The old refresh token can **never** be used again
- If you fail to save the new refresh token, you're locked out

**What breaks:**
- Two processes read the same refresh token
- Process A refreshes → gets new tokens → old refresh token is now dead
- Process B tries to refresh with the old (dead) token → `invalid_grant`
- Process B may overwrite the file with error state
- **All** subsequent refreshes fail until someone runs `/login` again

**This is why locking is non-negotiable.** See [Section 7: The Lock Contract](#7-the-lock-contract).

---

## 4. Claude Code CLI Internals (Reverse-Engineered)

> **Source:** `strings` analysis of the compiled binary.
> **Binary:** `/root/.local/share/claude/versions/<version>` (ELF, ~215MB)
> **Version at time of analysis:** 2.1.50 (Feb 2026)
>
> All findings include obfuscated symbol names from the binary.
> See [Section 12](#12-re-verification-when-cli-updates) for how to re-verify after updates.

### 4.1 OAuth Constants

| Constant | Value | How to find in binary |
|----------|-------|-----------------------|
| Token URL | `https://console.anthropic.com/v1/oauth/token` | `strings $BIN \| grep "console.anthropic.com/v1/oauth"` |
| Client ID | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` | `strings $BIN \| grep "9d1c250a"` |
| Grant type | `refresh_token` | Hardcoded in refresh function `WwA()` |

### 4.2 Storage Backend (symbol: `LsI`)

The CLI uses a plaintext JSON storage backend:

```js
// Deobfuscated from binary symbol LsI
const storage = {
  name: "plaintext",
  read() {
    // Reads ~/.claude/.credentials.json synchronously
    return JSON.parse(fs.readFileSync(storagePath, { encoding: "utf8" }))
  },
  update(data) {
    fs.writeFileSync(storagePath, JSON.stringify(data), { encoding: "utf8", flush: false })
    fs.chmodSync(storagePath, 384)  // 0o600
  }
}
```

**Verify:**
```bash
strings /root/.local/share/claude/versions/2.1.50 \
  | grep -oP '.{0,300}Storing credentials in plaintext.{0,100}'
```

**Note:** `flush: false` — no fsync. A crash right after write could lose tokens.

**Note:** CLI writes `0o600`. Our production needs `0o644` for worker UID drop. The `claude-credentials-fix` systemd path unit (if installed) re-applies `0o644` after writes. See `docs/troubleshooting/oauth-credentials-issue.md`.

### 4.3 Refresh Function (symbol: `WwA`)

```js
// Deobfuscated from binary symbol WwA
async function refreshToken(oldRefreshToken) {
  const response = await axios.post(TOKEN_URL, {
    grant_type: "refresh_token",
    refresh_token: oldRefreshToken,
    client_id: CLIENT_ID,
    scope: SCOPES.join(" ")
  })

  const { access_token, refresh_token = oldRefreshToken, expires_in } = response.data
  //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //    Defensive: falls back to old token if response omits new one

  return {
    accessToken: access_token,
    refreshToken: refresh_token,  // NEW token from Anthropic
    expiresAt: Date.now() + expires_in * 1000,
    scopes: parseScopes(response.data.scope),
    subscriptionType: ...,
    rateLimitTier: ...
  }
}
```

**Verify:**
```bash
strings /root/.local/share/claude/versions/2.1.50 \
  | grep -oP '.{0,500}tengu_oauth_token_refresh_success.{0,500}' | head -3
# Look for: {access_token:I,refresh_token:D=H,expires_in:B}=L
# The "D=H" is the defensive fallback
```

### 4.4 Lock-and-Refresh Flow (symbol: `YpA`)

The CLI's complete refresh-with-lock logic:

```js
// Deobfuscated from binary symbol YpA
// Dependencies: R$B = proper-lockfile, XL() = getClaudeDir (~/.claude),
//   QR$ = readCredentialsAsync, Jb = isExpired, WwA = refreshToken,
//   ns = saveCredentials, gWH = clearCredentialCache, uD = getCachedCredentials,
//   clH = singleton promise (deduplicates concurrent in-process callers)

async function refreshWithLock(retryCount = 0, force = false) {
  // --- Pre-checks (before lock) ---
  let cached = getCachedCredentials()
  if (!force && (!cached?.refreshToken || !isExpired(cached.expiresAt))) return false
  if (!cached?.refreshToken) return false

  // Clear in-memory caches, re-read from disk
  clearAllCaches()
  let creds = await readCredentialsFromDisk()
  if (!creds?.refreshToken || !isExpired(creds.expiresAt)) return false

  // --- Acquire lock on ~/.claude DIRECTORY ---
  let claudeDir = getClaudeDir()  // ~/.claude
  await fs.promises.mkdir(claudeDir, { recursive: true })

  let release
  try {
    release = await properLockfile.lock(claudeDir)  // LOCKS THE DIRECTORY
  } catch (err) {
    if (err.code === 'ELOCKED') {
      if (retryCount < 5) {
        await sleep(1000 + Math.random() * 1000)  // 1-2s jitter
        return refreshWithLock(retryCount + 1, force)
      }
      return false  // Give up after 5 retries
    }
    return false
  }

  try {
    // --- Double-check after lock (critical for rotating tokens) ---
    clearAllCaches()
    let freshCreds = await readCredentialsFromDisk()
    if (!freshCreds?.refreshToken || !isExpired(freshCreds.expiresAt)) {
      return false  // Another process already refreshed — skip
    }

    // --- Actually refresh ---
    let newCreds = await refreshToken(freshCreds.refreshToken)
    saveCredentials(newCreds)
    clearAllCaches()
    return true
  } catch (err) {
    // --- Error recovery ---
    clearAllCaches()
    let recovered = await readCredentialsFromDisk()
    if (recovered && !isExpired(recovered.expiresAt)) {
      return true  // Another process saved valid tokens during our attempt
    }
    return false
  } finally {
    await release()
  }
}

// Singleton wrapper — prevents multiple in-process callers from each trying to refresh
let singletonPromise = null
function refreshEntry(retryCount = 0, force = false) {
  if (retryCount === 0 && !force) {
    if (singletonPromise) return singletonPromise
    singletonPromise = refreshWithLock(retryCount, force).finally(() => { singletonPromise = null })
    return singletonPromise
  }
  return refreshWithLock(retryCount, force)
}
```

**Verify lock target:**
```bash
strings /root/.local/share/claude/versions/2.1.50 \
  | grep -oP '.{0,200}R\$B\.lock.{0,200}' | head -3
# Expect: R$B.lock(D) where D = XL() = ~/.claude directory
```

**Verify proper-lockfile:**
```bash
strings /root/.local/share/claude/versions/2.1.50 \
  | grep -oP '.{0,50}ELOCKED.{0,50}' | head -5
```

### 4.5 Telemetry Events (prefix: `tengu_oauth_token_refresh_`)

| Event | Meaning |
|-------|---------|
| `lock_acquiring` | About to call `properLockfile.lock()` |
| `lock_acquired` | Lock obtained |
| `lock_retry` | Lock held by another process, retrying (includes `retryCount`) |
| `lock_retry_limit_reached` | Gave up after 5 retries |
| `lock_error` | Lock failed for unexpected reason |
| `starting` | About to POST to Anthropic |
| `success` | Anthropic returned new tokens |
| `failure` | Refresh failed (includes `error`, `responseBody`) |
| `completed` | New tokens saved |
| `lock_releasing` / `lock_released` | Lock released |
| `race_resolved` | After lock, token already valid (another process refreshed) |
| `race_recovered` | Refresh failed but valid tokens found (another process saved) |

**Verify:**
```bash
strings /root/.local/share/claude/versions/2.1.50 \
  | grep "tengu_oauth_token_refresh" | sort -u
```

### 4.6 Environment Variable Overrides

| Variable | Effect |
|----------|--------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Bypass file-based credentials entirely; use this token directly |
| `CLAUDE_CODE_CUSTOM_OAUTH_URL` | Custom OAuth endpoint (validated against internal allowlist) |
| `CLAUDE_CODE_USE_BEDROCK` | Disable OAuth, use AWS Bedrock |
| `CLAUDE_CODE_USE_VERTEX` | Disable OAuth, use GCP Vertex |
| `CLAUDE_CODE_USE_FOUNDRY` | Disable OAuth, use Foundry |

**Verify:**
```bash
strings /root/.local/share/claude/versions/2.1.50 \
  | grep -E "CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_USE_BEDROCK"
```

---

## 5. Our Web App: anthropic-oauth.ts

**File:** `apps/web/lib/anthropic-oauth.ts`

Our web app's refresh logic mirrors the CLI's pattern. The critical requirement is that it locks the **same target** (`~/.claude` directory) so the CLI and web app never race.

### Exported functions

| Function | Purpose | Refreshes? |
|----------|---------|------------|
| `getValidAccessToken({ minimumValidityMs? })` | Get token, refresh if expired/expiring soon | Yes (with lock) |
| `hasOAuthCredentials()` | Check if credentials file exists and has refresh token | No |
| `readClaudeCredentials()` | Read raw credentials from disk | No |
| `getAccessTokenReadOnly()` | Get token without refreshing (returns `isExpired` flag) | No |
| `isTokenExpired(expiresAt)` | Check if timestamp is within 5-min buffer | No |
| `startOAuthRefreshHeartbeat()` | Background refresh cadence (15m checks, 2h minimum validity) | Yes (with lock) |

### Callers

| File | Function called | Context |
|------|----------------|---------|
| `app/api/claude/stream/route.ts` | `hasOAuthCredentials()`, `getValidAccessToken()` | Chat streaming endpoint |
| `lib/automation/executor.ts` | `hasOAuthCredentials()`, `getValidAccessToken()` | Automation job execution |

---

## 6. Token Flow Through the System

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        TOKEN LIFECYCLE                               │
│                                                                      │
│  /login (CLI)                                                        │
│      │                                                               │
│      ▼                                                               │
│  ~/.claude/.credentials.json  ◄─── CLI refresh (locks ~/.claude)     │
│      │                         ◄─── Web app refresh (locks ~/.claude)│
│      │                                                               │
│      ├──► stream/route.ts ──► getValidAccessToken()                  │
│      │        │                                                      │
│      │        ▼                                                      │
│      │    oauthAccessToken (in memory)                               │
│      │        │                                                      │
│      │        ▼                                                      │
│      │    ├──► (default) Worker Pool Manager ──► worker-entry.mjs    │
│      │    │          │                                                │
│      │    │          ▼                                                │
│      │    │   prepareRequestEnv() ─► CLAUDE_CODE_OAUTH_TOKEN          │
│      │    │          │                                                │
│      │    │          ▼                                                │
│      │    │   Claude Agent SDK query() ──► Anthropic API              │
│      │    │                                                           │
│      │    └──► (fallback) runAgentChild() ──► run-agent.mjs           │
│      │               │                                                │
│      │               ▼                                                │
│      │      env: CLAUDE_CODE_OAUTH_TOKEN + HOME=workspace             │
│      │               │                                                │
│      │               ▼                                                │
│      │      Claude Agent SDK query() ──► Anthropic API                │
│      │                                                               │
│      ├──► executor.ts ──► getValidAccessToken()                      │
│      │        │                                                      │
│      │        ▼                                                      │
│      │    (same worker flow as above)                                │
│      │                                                               │
│      └──► OpenClaw/Moltbot (separate: see fix-moltbot skill)        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Key insight:** The token is read from disk once per request by `getValidAccessToken()`, then passed through the system as a string. Workers never read the credentials file directly — they receive the token via IPC and consume it through `CLAUDE_CODE_OAUTH_TOKEN` env var.
Additionally, Next.js startup calls `startOAuthRefreshHeartbeat()` so refresh is not only request-driven.

---

## 7. The Lock Contract

**This is the most important section.** If you touch anything OAuth-related, you must understand this.

### The Rule

> **All processes that refresh tokens MUST lock `~/.claude` (the directory) using `proper-lockfile` before refreshing.**

### Why the directory, not the file?

Claude Code CLI locks `~/.claude`. We must lock the same target. `proper-lockfile` creates a `.lock` entry for each target — if we lock a different target, the locks don't see each other and we get races.

### Lock parameters (must match CLI)

| Parameter | CLI value | Our value | Why |
|-----------|-----------|-----------|-----|
| Lock target | `~/.claude` (directory) | `~/.claude` (directory) | Must be identical |
| Stale timeout | 10,000 ms | 10,000 ms | Consider lock abandoned after this |
| Max retries | 5 | 5 | Give up and skip refresh |
| Retry delay | 1-2s (random) | 1-2s (random) | Avoid thundering herd |

### The double-check pattern (both CLI and web app do this)

```text
1. Read credentials from disk
2. Check if expired → yes, need refresh
3. Acquire lock on ~/.claude
4. READ CREDENTIALS AGAIN  ← critical!
5. Check if STILL expired → if no, skip (another process refreshed)
6. Refresh token
7. Save new tokens
8. Release lock
```

Step 4 is critical. Without it, you'd refresh with a stale token that was already consumed by whoever held the lock before you.

---

## 8. Consumers (Who Reads the Token)

### Direct file readers

| Process | How it reads | Refreshes? |
|---------|-------------|------------|
| Claude Code CLI | `fs.readFileSync` via storage backend | Yes (with dir lock) |
| Web app (`anthropic-oauth.ts`) | `fs.readFileSync` | Yes (with dir lock) |
| OpenClaw/Moltbot | Separate auth-profiles.json (copy) | No (manual via `/fix-moltbot` skill) |

### Indirect consumers (receive token via IPC)

| Process | How it gets token | Source |
|---------|------------------|--------|
| Worker pool workers | `CLAUDE_CODE_OAUTH_TOKEN` env var | Set by `prepareRequestEnv()` |
| Per-request runners (`run-agent.mjs`) | `CLAUDE_CODE_OAUTH_TOKEN` env var | Set by `runAgentChild()` (`agent-child-runner.ts`) |

### Permission requirements

| Path | Required perms | Why |
|------|---------------|-----|
| `/root` | `711` (drwx--x--x) | Worker-pool workers traverse to `/root/.claude/projects` after UID drop |
| `/root/.claude` | `711` (drwx--x--x) | Worker-pool workers traverse to shared SDK state |
| `/root/.claude/projects` | `1777` (drwxrwxrwt) | Worker-pool workers write per-session state after UID drop |
| `/root/.claude/.credentials.json` | `644` (-rw-r--r--) | Shared credential file for CLI + web refresh/monitoring |

**Problem:** CLI writes `0o600`. The `claude-credentials-fix` systemd path unit (if installed) fixes this automatically. Otherwise, manually `chmod 644` after `/login`.

---

## 9. Failure Modes and Diagnosis

### Failure 1: `invalid_grant` (refresh token consumed)

**Symptom:** All automations fail with `Anthropic token refresh failed (400): {"error": "invalid_grant"}`

**Cause:** The active refresh token chain is invalid. Common reasons:
- A refresh race consumed a token you later retried
- Session/token chain was revoked upstream
- Credentials persistence drift left a dead chain on disk

**Current behavior:** Proactive heartbeat marks the failing refresh token chain as dead, escalates in Sentry after repeated failures, and suppresses repeated retry spam until credentials change (for example after `/login`).

**Diagnosis:**
```bash
# Check automation worker logs
journalctl -u automation-worker --since "1 hour ago" | grep "invalid_grant"

# Check web app logs
journalctl -u alive-production --since "1 hour ago" | grep "token refresh failed"
```

**Fix:** Run `/login` in Claude Code CLI to mint a new chain. See [Section 10](#10-recovery-procedures).

### Failure 2: `Invalid API key` (stale file handle)

**Symptom:** Workers report "Invalid API key" even though credentials file is valid.

**Cause:** Worker process has a cached file handle to a deleted inode (CLI did atomic write).

**Diagnosis:**
```bash
# Check if any process holds a deleted credentials file
lsof | grep credentials | grep deleted
```

**Fix:** Restart the service: `systemctl restart alive-production`

### Failure 3: Permission denied (UID drop)

**Symptom:** Workers can't read credentials after dropping to site user.

**Diagnosis:**
```bash
ls -la /root/.claude/.credentials.json
# If -rw------- (600), workers can't read it
```

**Fix:** `chmod 644 /root/.claude/.credentials.json`

### Failure 4: `expiresAt: null` (corrupted credentials)

**Symptom:** Credentials file has null or missing fields.

**Cause:** A refresh attempt failed partway through writing.

**Diagnosis:**
```bash
cat /root/.claude/.credentials.json | python3 -m json.tool
# Check for null values in accessToken, refreshToken, expiresAt
```

**Fix:** Run `/login` in Claude Code CLI.

---

## 10. Recovery Procedures

### Standard recovery: `/login`

```bash
# In any Claude Code CLI session:
/login
# This opens a browser OAuth flow and writes completely fresh tokens

# After login, fix permissions for workers:
chmod 644 /root/.claude/.credentials.json

# Restart services to pick up new tokens:
systemctl restart alive-production
systemctl restart automation-worker
```

### Emergency: verify token works before restarting

```bash
# Read current tokens
node -e "
  const c = require('/root/.claude/.credentials.json').claudeAiOauth;
  console.log('Token present:', !!c.accessToken);
  console.log('Refresh present:', !!c.refreshToken);
  console.log('Expires:', new Date(c.expiresAt).toISOString());
  console.log('Hours left:', ((c.expiresAt - Date.now()) / 3600000).toFixed(1));
"
```

### Verify refresh token works (WARNING: consumes the token!)

**Only do this if you will save the result:**

```bash
# This CONSUMES the current refresh token — you MUST save the new one
node -e "
  const fs = require('fs');
  const creds = JSON.parse(fs.readFileSync('/root/.claude/.credentials.json', 'utf-8'));
  const rt = creds.claudeAiOauth.refreshToken;
  fetch('https://console.anthropic.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
      refresh_token: rt,
    }),
  }).then(r => r.json()).then(data => {
    if (data.error) { console.error('FAILED:', data); process.exit(1); }
    creds.claudeAiOauth.accessToken = data.access_token;
    creds.claudeAiOauth.refreshToken = data.refresh_token;
    creds.claudeAiOauth.expiresAt = Date.now() + data.expires_in * 1000;
    fs.writeFileSync('/root/.claude/.credentials.json', JSON.stringify(creds));
    fs.chmodSync('/root/.claude/.credentials.json', 0o644);
    console.log('Saved. New expiry:', new Date(creds.claudeAiOauth.expiresAt).toISOString());
  }).catch(e => console.error(e));
"
```

---

## 11. Verification Commands

### Check current token status

```bash
node -e "
  const c = require('/root/.claude/.credentials.json').claudeAiOauth;
  const hoursLeft = ((c.expiresAt - Date.now()) / 3600000).toFixed(1);
  console.log('Status:', hoursLeft > 0 ? 'VALID' : 'EXPIRED');
  console.log('Hours left:', hoursLeft);
  console.log('Expires:', new Date(c.expiresAt).toISOString());
"
```

### Check file permissions

```bash
ls -la /root/.claude/.credentials.json
# Want: -rw-r--r-- (644) for worker access
# If -rw------- (600): chmod 644 /root/.claude/.credentials.json

ls -la /root/ /root/.claude/
# Want: drwx--x--x for both (711 minimum)
```

### Check for stale lock

```bash
ls -la /root/.claude.lock 2>/dev/null
# If this directory exists and is old, the lock may be stale
# proper-lockfile handles stale detection automatically (10s timeout)
```

### Check automation worker health

```bash
curl -s http://localhost:5070/health | python3 -m json.tool
journalctl -u automation-worker -n 20 --no-pager | grep -E "refresh|oauth|invalid"
```

---

## 12. Re-verification When CLI Updates

When a new Claude Code CLI version ships, run these commands to check if OAuth behavior changed.

```bash
VER="2.1.50"  # ← Update this to the new version
BIN="/root/.local/share/claude/versions/$VER"

# 0. Confirm binary exists
ls -la "$BIN"

# 1. Lock target still ~/.claude directory?
strings "$BIN" | grep -oP '.{0,200}R\$B\.lock.{0,200}' | head -3
# EXPECT: R$B.lock(D) where D comes from XL() — the ~/.claude dir

# 2. Still uses proper-lockfile?
strings "$BIN" | grep -oP '.{0,50}ELOCKED.{0,50}' | head -3
# EXPECT: ELOCKED error handling code

# 3. Refresh token rotation still the same?
strings "$BIN" | grep -oP '.{0,500}tengu_oauth_token_refresh_success.{0,500}' | head -3
# EXPECT: {access_token:I,refresh_token:D=H,expires_in:B}
# The D=H means "fallback to old refresh token if not in response"

# 4. Storage backend still plaintext?
strings "$BIN" | grep "Storing credentials in plaintext"
# EXPECT: "Warning: Storing credentials in plaintext."

# 5. Same credential structure?
strings "$BIN" | grep -oP '.{0,200}claudeAiOauth.{0,200}' | head -3
# EXPECT: .claudeAiOauth={accessToken:...,refreshToken:...,expiresAt:...}

# 6. Same telemetry events?
strings "$BIN" | grep "tengu_oauth_token_refresh" | sort -u
# EXPECT: Same list as Section 4.5

# 7. Same OAuth constants (client ID)?
strings "$BIN" | grep "9d1c250a"
# EXPECT: 9d1c250a-e61b-44d9-88ed-5944d1962f5e

# 8. Same env var overrides?
strings "$BIN" | grep -E "CLAUDE_CODE_OAUTH_TOKEN[^_]"
# EXPECT: CLAUDE_CODE_OAUTH_TOKEN (the env var that bypasses file credentials)
```

**If any of these change:**
1. Update this document
2. Review `apps/web/lib/anthropic-oauth.ts` — lock target, retry params, etc.
3. Review `packages/worker-pool/src/env-isolation.ts` — env var names
4. Test that automations still work

---

## 13. File Index

Every file in the codebase that touches OAuth, and its role:

### Core OAuth logic

| File | Role | Refreshes? |
|------|------|------------|
| `apps/web/lib/anthropic-oauth.ts` | Token read, refresh, lock coordination | **Yes** |
| `~/.claude/.credentials.json` | Token storage (shared with CLI) | N/A |

### Token consumers (read-only)

| File | Role |
|------|------|
| `apps/web/app/api/claude/stream/route.ts` | Calls `getValidAccessToken()`, passes to worker |
| `apps/web/lib/automation/executor.ts` | Calls `getValidAccessToken()` for automation jobs |
| `packages/worker-pool/src/env-isolation.ts` | Sets `CLAUDE_CODE_OAUTH_TOKEN` env var per request |
| `packages/worker-pool/src/worker-entry.mjs` | Configures `CLAUDE_CONFIG_DIR`, receives token via IPC |
| `packages/worker-pool/src/manager.ts` | Monitors credentials file for changes, restarts workers |
| `apps/web/instrumentation.ts` | Starts proactive OAuth refresh heartbeat at server startup |

### Related documentation

| File | What it covers |
|------|---------------|
| **This file** | Everything OAuth |
| `docs/troubleshooting/oauth-credentials-issue.md` | `Invalid API key` error, file permissions, stale handles |
| `.agents/skills/fix-moltbot/SKILL.md` | Copying tokens to OpenClaw's auth-profiles.json |
| `docs/architecture/persistent-worker-pool.md` | How workers consume tokens |

### External dependencies

| Dependency | Used by | Purpose |
|------------|---------|---------|
| `proper-lockfile` | CLI (bundled), `anthropic-oauth.ts` | Directory-level locking |
| `@webalive/shared` → `retryAsync` | `anthropic-oauth.ts` | Retry with exponential backoff |

---

*Last updated: 2026-02-23.*
*Binary analyzed: Claude Code CLI v2.1.50 (`/root/.local/share/claude/versions/2.1.50`).*
*Methodology: `strings` extraction + pattern matching on minified JS bundled in ELF binary.*
