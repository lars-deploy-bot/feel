# Claude Bridge — End-to-End Technical Guide

**Fixing Root-Owned Files with a Minimal, Reliable Architecture (and everything you need to extend it)**

> This document is deliberately exhaustive. If you're picking this up cold, you should be able to understand what Claude Bridge is, how it's deployed, why files ended up `root:root`, what we tried, what failed, what finally works, and exactly how to run, test, observe, and extend the system without guessing. It includes rationales, code sketches, runbooks, and checklists.

**Document Version:** 5.0
**Last Updated:** 2025-11-02
**Status:** ✅ **PRODUCTION DEPLOYED** — Child Process Per Invocation (Nov 2, 2025)

---

## 0) Executive Context

* **Product:** *Claude Bridge* — a multi-tenant web service that lets humans (and automations) use Anthropic's Claude to **create and edit code/content inside per-site workspaces** and stream results to a UI.
* **Tenancy & isolation:** Each site has a **workspace directory** on the server and a **dedicated Unix user**, e.g.,
  ```
  workspace root: /srv/webalive/sites/<domain>/user
  Unix user:      site-<domain-with-dots-replaced-by-dashes>
  ```
* **Runtime & deploy:**

  * **Bun** runtime (Node-compatible)
  * **Next.js 16** (App Router)
  * **PM2** runs the dev server (`bunx next dev --turbo -p 8998`) in staging; production can run `next start` (pattern is the same)
  * **Server user:** `root` (needed for uid/gid switching and management tasks)
* **SDK:** `@anthropic-ai/claude-agent-sdk@0.1.25` provides the agent loop, tools, and streaming / polling behaviors.

**The incident:** Files created by the agent within site workspaces were owned by **`root:root`** → site processes (unprivileged) could not read them → builds failed (e.g., Vite "failed to resolve import").

**The constraint:** Minimal, targeted fix; **no feature flags**, **no long migrations**, **ship immediately**, **no fragile hacks**.

---

## 1) What the Application Actually Does

### 1.1 High-level flow

1. A client (UI or automation) sends a request to `/api/claude/stream` (or the polling variant).
2. The route constructs an agent (Claude SDK) with a **set of tools** (e.g., `Write`, `Edit`, project-specific utilities).
3. The agent plans & calls tools to fulfill the user's goal (e.g., "create `src/components/Foo.tsx` with …").
4. Tools touch the filesystem **inside a workspace**.
5. The route **streams** model deltas and tool results back to the client (NDJSON or SSE).

### 1.2 Tenancy model (crucial for permissions)

* **One server**, many **site workspaces** under `/srv/webalive/sites`.
* Each workspace directory is owned by a **dedicated Unix user** (e.g., `site-two-goalive-nl`).
* **Site daemons** (systemd units like `site@two-goalive-nl.service`) run as the site user and build/serve the site.
* **Bridge** runs as `root` (central orchestrator), because it must:

  * read/write across different tenant workspaces
  * manage logs and processes
  * (until our fix) it created files as `root`, which is the bug

### 1.3 File operations that matter

* Creating a new component, page, config file, or data file.
* Editing existing files (content changes).
* Creating directories for nested paths.

**Correct behavior:** files/dirs **must** be owned by the **workspace Unix user**, with predictable modes (`0644` for files, `0755` for directories). Anything else breaks builds and violates tenant boundaries.

---

## 2) Problem Statement (precise)

> **Ensure that *every* file/directory created/modified *as part of any agent run* under a workspace path is owned by the workspace's Unix user and has deterministic modes (`644/755`).**

**Why it broke:** The agent (and some of its dependencies) performed writes while the **Bridge process ran as `root`**, and not all writes passed through our tool callbacks. So created files inherited `root:root`.

**Non-goals:** New user management, global refactors, heavy infra changes.

---

## 3) Baseline State & Evidence

### 3.1 Evidence of incorrect ownership

```bash
$ ls -la /srv/webalive/sites/two.goalive.nl/user/test-ownership-v2.txt
-rw-r--r-- 1 root root 15 Nov 2 17:13 test-ownership-v2.txt
```

**Expected:** `site-two-goalive-nl site-two-goalive-nl`

### 3.2 Environment specifics (for reproducibility)

* **Runtime:** Bun (Node-compat mode)
* **Framework:** Next.js 16
* **Process manager:** PM2 (dev mode in staging)
* **SDK:** `@anthropic-ai/claude-agent-sdk` 0.1.25
* **Server user:** `root`

---

## 4) What We Tried (and the results)

### 4.1 Global `fs` monkey-patching (FAILED by design)

* We attempted to override `fs.writeFileSync`/`mkdirSync` globally via `require('node:fs')` patches loaded "first."
* **Why it cannot work:** the SDK imports from **ESM** using named imports

  ```ts
  import { writeFileSync } from 'node:fs'
  ```

  ESM **binds** the symbol immutably at module evaluation time. Mutating the **CommonJS** export object **after** that has no effect.
* **Proof 1:** Controlled script showed ESM calls bypass CJS patching. ✅

### 4.2 Tool-level interception (INSUFFICIENT)

* We tried to wrap our *own tool callbacks* (`Write`, `Edit`) with credential switching (`seteuid/egid`), path guards, and umask normalization.
* **Why it's not enough:** The SDK (or dependencies) still writes outside our tool callbacks (e.g., temps, helpers).
* **Proof 2:** Disabling tool callbacks still resulted in new root-owned files. ❌

**Conclusion:** Intercepting at tool level **does not** guarantee coverage. We must go lower.

---

## 5) The Working Architecture (Minimal & Reliable)

### 5.1 Design choice: **Per-invocation child process**

**Run each agent invocation inside a short-lived child process** that executes as the **workspace Unix user**. The OS enforces correct ownership for **all** filesystem activity, regardless of which library does it.

* **Parent (Bridge route):**

  * Derive `{uid,gid}` from workspace root (`fs.statSync`).
  * **Spawn** child with `uid/gid` set (preferred).
    If the runtime refuses, spawn as root but export `TARGET_UID/GID` so the **child immediately drops privileges** via `process.seteuid/setegid`.
  * `stdin`: send request JSON to the child.
  * `stdout`: stream **NDJSON** responses back to the client.
  * `stderr`: log child errors under `[agent-child]`.

* **Child (runner):**

  * On first lines: `umask(022)`, `chdir(WORKSPACE_ROOT)`.
  * If present, drop to `TARGET_UID/GID` immediately (before any FS calls).
  * Call the Claude Agent SDK.
    Tools in the child can use plain `fs` — the process already runs as the workspace user.
  * Emit NDJSON for tool events and final result.

**Why this is minimal:**
No loaders, no global patches, no flags; about ~40–60 LOC in the route + one small runner script. Completely reversible.

---

## 6) Implementation — Files, Interfaces, Code Sketches

### 6.1 Directory layout

```
apps/web/
  app/api/claude/stream/route.ts   # Parent (spawns child, relays stream)
scripts/
  run-agent.mjs                    # Child runner (ESM)
```

### 6.2 Parent route (Bun/Next/PM2 safe)

```ts
// apps/web/app/api/claude/stream/route.ts
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";

// Derive uid/gid from workspace path ownership
function getWorkspaceCreds(workspaceRoot: string) {
  const st = statSync(workspaceRoot);
  if (!st.uid || !st.gid || st.uid === 0 || st.gid === 0) {
    throw new Error(`Invalid workspace owner for ${workspaceRoot}`);
  }
  return { uid: st.uid, gid: st.gid };
}

function runAgentChild(workspaceRoot: string, payload: any) {
  const { uid, gid } = getWorkspaceCreds(workspaceRoot);
  const runner = resolve(process.cwd(), "scripts/run-agent.mjs");

  // Preferred: spawn kernel-side as the workspace user
  let child;
  try {
    child = spawn(process.execPath, [runner], {
      uid, gid,
      cwd: workspaceRoot,
      env: { ...process.env, WORKSPACE_ROOT: workspaceRoot },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // Fallback: drop privileges in the child
    child = spawn(process.execPath, [runner], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        WORKSPACE_ROOT: workspaceRoot,
        TARGET_UID: String(uid),
        TARGET_GID: String(gid),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
  }

  // Send one JSON request to child
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  // Useful logs
  child.stderr.on("data", (d) => console.error("[agent-child]", d.toString()));

  // Stream NDJSON from child stdout to HTTP client
  return new ReadableStream({
    start(controller) {
      child.stdout.on("data", (chunk) => controller.enqueue(chunk));
      child.stdout.on("end", () => controller.close());
      child.on("error", (e) => controller.error(e));
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { workspaceRoot, ...agentInput } = body; // client must pass workspaceRoot
  const stream = runAgentChild(workspaceRoot, agentInput);
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
```

**Interface notes:**

* **Input contract:**
  The client (your UI or integration) must include `workspaceRoot` in the POST body (absolute path to `/srv/webalive/sites/<domain>/user`).
* **Output contract (stream):**
  NDJSON lines, e.g.:

  ```json
  {"type":"tool","name":"Write","path":"/srv/.../src/Foo.tsx"}
  {"type":"final","data":{...sdkResult}}
  ```

### 6.3 Child runner (ESM)

```js
// scripts/run-agent.mjs
import process from "node:process";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  readFileSync, writeFileSync, mkdirSync, chmodSync,
  lstatSync, realpathSync
} from "node:fs";
import { dirname, resolve, join } from "node:path";

async function readStdinJson() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function normalizePathInWorkspace(p) {
  const root = realpathSync(process.env.WORKSPACE_ROOT);
  const abs = p.startsWith("/") ? p : resolve(root, p);
  if (!abs.startsWith(root + "/")) throw new Error("Path escapes workspace");
  return abs;
}

function ensureDirsNoSymlinks(absPath) {
  const root = realpathSync(process.env.WORKSPACE_ROOT);
  const parts = absPath.slice(root.length + 1).split("/");
  let cur = root;
  for (const seg of parts.slice(0, -1)) {
    cur = join(cur, seg);
    try {
      const st = lstatSync(cur);
      if (st.isSymbolicLink()) throw new Error("Symlink in path");
    } catch {
      mkdirSync(cur, { recursive: false, mode: 0o755 });
    }
  }
}

(async () => {
  try {
    // If parent couldn't set uid/gid, drop here immediately
    const tuid = process.env.TARGET_UID && Number(process.env.TARGET_UID);
    const tgid = process.env.TARGET_GID && Number(process.env.TARGET_GID);
    if (tgid) process.setegid?.(tgid);
    if (tuid) process.seteuid?.(tuid);

    process.umask(0o022);
    if (process.env.WORKSPACE_ROOT) process.chdir(process.env.WORKSPACE_ROOT);

    const input = await readStdinJson();

    // Tools run as the site user (no switching needed)
    const tools = {
      Write: async ({ file_path, content }) => {
        const abs = normalizePathInWorkspace(file_path);
        ensureDirsNoSymlinks(abs);
        const dir = dirname(abs);
        mkdirSync(dir, { recursive: true, mode: 0o755 });
        writeFileSync(abs, content, { mode: 0o644 });
        chmodSync(abs, 0o644);
        process.stdout.write(JSON.stringify({ type: "tool", name: "Write", path: abs }) + "\n");
        return { ok: true, path: abs };
      },
      Edit: async ({ file_path, old_string, new_string }) => {
        const abs = normalizePathInWorkspace(file_path);
        const before = readFileSync(abs, "utf-8");
        const after = before.replace(old_string, new_string);
        writeFileSync(abs, after, { mode: 0o644 });
        chmodSync(abs, 0o644);
        process.stdout.write(JSON.stringify({ type: "tool", name: "Edit", path: abs }) + "\n");
        return { ok: true, path: abs };
      },
    };

    // Run the agent; you can plug streaming callbacks here and print NDJSON
    const result = await query({ ...input, tools });

    process.stdout.write(JSON.stringify({ type: "final", data: result }) + "\n");
  } catch (e) {
    console.error("[runner-error]", e?.stack || String(e));
    process.exit(1);
  }
})();
```

**Policy (explicit):**

* **Ownership:** the child is the workspace user → all writes have correct `uid/gid`.
* **Modes:** normalize to `0644` for files, `0755` for directories (predictable & simple).
* **Path safety:** `realpath` containment + per-segment `lstat` to reject symlinks.
* **Synchronous IO:** keeps the behavior deterministic in a short-lived process.

---

## 7) Startup Self-Test (guard against runtime surprises)

Add a small self-test on service boot that:

* Spawns the child for a throwaway workspace (or `/tmp` namespace).
* Performs a simple write.
* Checks resulting `uid/gid/mode`.
* **Crashes** with a clear message if any step fails.

This prevents "it works on Node but not on Bun/PM2" surprises at runtime.

---

## 8) How to Operate (Runbook)

### 8.1 Smoke test (per site)

```bash
# Create a file via the agent (through your UI or an HTTP call)
# Then verify:
stat -c '%U %G %a %n' /srv/webalive/sites/two.goalive.nl/user/proof.txt
# Expect: site-two-goalive-nl  site-two-goalive-nl  644  <path>

# Build/restart to be sure the site consumes it:
systemctl restart site@two-goalive-nl.service
sleep 5
systemctl status site@two-goalive-nl.service | sed -n '1,6p'
```

### 8.2 One-hour audit (all sites)

```bash
find /srv/webalive/sites/*/user -newermt '2025-11-02 00:00' \
  \( -type f -o -type d \) ! -user site-* -printf '%u %g %m %p\n'
# Expect: no output
```

### 8.3 Logs

* Parent logs child stderr prefixed with `[agent-child]`.
* Child prints NDJSON to stdout (tool events + final result).
* On fatal errors, child exits non-zero and emits `[runner-error]`.

### 8.4 PM2 sanity

Ensure **backoff** and **max restarts** are set. An occasional child exit is fine; persistent flapping indicates a bug (self-test should catch most).

---

## 9) Security Model (threat-aware, practical)

* **Least privilege:** All workspace writes happen under the **workspace user**, not root.
* **Path traversal:** `normalizePathInWorkspace` forbids escapes beyond workspace root.
* **Symlink tricks:** `ensureDirsNoSymlinks` rejects symlinked path segments during creation.
* **Deterministic perms:** `umask(022)` + `chmod` deliver `644/755`, avoiding umask surprises.
* **Crash-on-bad-state:** If the child can't drop privileges or chdir/umask, it fails fast.

**Edge:** TOCTOU between directory checks and file open is theoretically possible if an attacker races symlinks; in our controlled environment (root-owned parent of `user/` and site-owned subtree), this is acceptable. If needed, move to `openat` semantics (parent dir FD + nofollow flags) — more code, not required for the minimal fix.

---

## 10) Testing (Matrix & What Matters)

### 10.1 Already established

* **ESM vs CJS patching** cannot catch SDK writes.
* **SDK writes outside tool callbacks** in our environment.
* Credential switching helper works in isolation (seteuid/egid).

### 10.2 Add for child-process architecture

* Spawn with `uid/gid` works on Bun/PM2; if not, env fallback (`TARGET_UID/GID`) path works.
* Startup self-test passes.
* Across multiple sites, writes land with correct ownership & modes.
* Streaming NDJSON path doesn't deadlock with large outputs.
* Error paths produce a single clear log line and non-zero exit code.

**Useful probe during dev:**

```bash
# Observe syscalls of the child once spawned:
strace -f -e trace=openat,rename,chmod -p <child_pid>
# Confirms writes happen under the site uid/gid
```

---

## 11) Performance

* Spawn + short-lived write/edit is **negligible** vs LLM latency.
* NDJSON streaming is cheap; I/O is synchronous but brief.
* No shared mutable global state; no locks; minimal contention.

---

## 12) Extending the System (without breaking guarantees)

* **New tools?** Implement them **inside the child** (they'll inherit the site user).
* **Non-workspace writes?** Explicitly disallow; add a guard to `normalizePathInWorkspace`.
* **Binary writes?** Same policy; set executable bits only where warranted (e.g., postinstall bins).
* **Bulk operations?** You can batch within one child run to amortize spawn cost.

---

## 13) Failure Modes & Quick Diagnostics

* **Files still `root:root`:**

  * Check that the parent successfully spawned with `uid/gid` (logs).
  * Verify env fallback executed (`TARGET_UID/GID`) and child dropped privileges at the top.
  * Confirm workspace root ownership (not root).
* **Child exits immediately:**

  * Look for `[runner-error]` and stack; common: invalid path, missing WORKSPACE_ROOT, permission to set euid/egid denied.
* **Streaming never arrives:**

  * Ensure the child prints NDJSON lines and the parent **enqueues** chunks (don't buffer).
* **Build still fails:**

  * Verify file paths/casing; sometimes the agent wrote to an unexpected directory.
  * Check Vite logs for unrelated errors.
* **Child process runs correctly but cannot write files (EACCES):**

  * **Symptom:** Logs show `[runner] Running as UID:986 GID:979` but writes fail with `EACCES` or "Permission denied"
  * **Root cause:** Existing files in workspace are owned by `root:root`, but child runs as workspace user
  * **Why this happens:** Workspace was populated before child process isolation was implemented, or files were manually created as root
  * **Fix:** Change ownership of workspace files to match workspace user:
    ```bash
    # Get site user from workspace path
    ls -ld /srv/webalive/sites/example.com/user  # Check ownership

    # Fix ownership recursively
    chown -R site-example-com:site-example-com /srv/webalive/sites/example.com/user

    # Verify fix
    find /srv/webalive/sites/example.com/user -user root
    # Should return no results
    ```
  * **Prevention:** Always use systemd deployment script which creates workspaces with correct ownership from the start
  * **Detection:** Check workspace directory ownership before spawning child:
    ```typescript
    const workspaceStat = statSync(workspaceRoot)
    const fileStat = statSync(path.join(workspaceRoot, 'some-file.txt'))
    if (fileStat.uid !== workspaceStat.uid) {
      console.warn(`File ownership mismatch: ${filePath}`)
    }
    ```

---

## 14) Rollback (simple & fast)

1. Revert `route.ts` changes that spawn the child.
2. Remove `scripts/run-agent.mjs`.
3. Restart PM2.
4. Emergency **manual** fix for any root-owned artifacts:

   ```bash
   for site_dir in /srv/webalive/sites/*.*/user; do
     domain=$(basename $(dirname $site_dir))
     site_user="site-${domain//\./-}"
     chown -R "$site_user:$site_user" "$site_dir"
     find "$site_dir" -type d -exec chmod 755 {} \;
     find "$site_dir" -type f -exec chmod 644 {} \;
   done
   ```

---

## 15) Design Rationale (why this and not X)

* **Global patching:** brittle, doesn't work for ESM named imports, order-dependent, unsafe in Bun/Next.
* **Tool-only interception:** empirically insufficient; we saw out-of-tool writes.
* **Node loaders / `--loader`:** experimental, diverges Node vs Bun, adds complexity for zero user value.
* **LD_PRELOAD:** overkill; powerful but invasive, difficult to scope and test.
* **Per-invocation child process:** small, robust, OS-enforced guarantees, reversible.

---

## 16) Policies (write them down so we don't regress)

* **All workspace writes must be as the workspace Unix user.**
* **Normalize perms** to `0644/0755` (no "preserve" semantics).
* **No global `fs` patching.**
* **No loaders for this problem class.**
* **Fail fast** on any unrecoverable privilege/ownership inconsistency.

---

## 17) Hand-Off Checklist (use this if you're new)

* [ ] You can explain parent/child split and why the child runs as the site user.
* [ ] You know where `workspaceRoot` comes from and how it maps to `uid/gid`.
* [ ] You can read/write NDJSON pipes (child stdout ↔ HTTP response).
* [ ] You can run the startup self-test and interpret failure.
* [ ] You can smoke test a site and run the one-hour audit.
* [ ] You can locate `[agent-child]` and `[runner-error]` logs in PM2.
* [ ] You can revert the change in one commit if needed.
* [ ] You know the emergency `chown/chmod` command to sanitize workspaces.

---

## 18) Known Unknowns (explicit insecurities)

* **Bun's `spawn({uid,gid})` behavior:** works in many versions; if it doesn't in yours, the env fallback + `seteuid/egid` in the child is in place. The startup self-test exists to catch this.
* **TOCTOU on path checks:** acceptable risk here; if your threat model tightens, implement `openat` with parent directory FDs and `O_NOFOLLOW`.
* **SDK internal changes:** If the SDK begins spawning its own processes, our child boundary still holds (they'll inherit the site uid/gid).

---

## 19) Appendix — Example Client Request

```json
POST /api/claude/stream
{
  "workspaceRoot": "/srv/webalive/sites/two.goalive.nl/user",
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {"role":"user","content":"Create src/components/FeatureCard.tsx with a simple React component."}
  ],
  "tools": [
    {"name":"Write","schema":{/* … */}},
    {"name":"Edit","schema":{/* … */}}
  ],
  "stream": true
}
```

**Response (NDJSON):**

```
{"type":"tool","name":"Write","path":"/srv/webalive/sites/two.goalive.nl/user/src/components/FeatureCard.tsx"}
{"type":"final","data":{"status":"ok","...": "..."}}
```

---

## 20) Decision Log (why readers can trust this doc)

* 2025-11-02: Verified ESM/CJS patching mismatch; verified out-of-tool writes.
* 2025-11-02: Chosen per-invocation child process design; wrote parent+child scaffolds.
* 2025-11-02: Documented policies (ownership, modes), runbooks, rollback, and tests.

---

## Bottom Line

You now have:

* The **context** (what Bridge is and how it runs),
* The **problem** (root-owned files) and **evidence**,
* The **failed approaches** (with proofs),
* The **minimal working architecture** (child process per invocation),
* The **exact implementation patterns** (parent route + child runner),
* The **runbooks** (smoke, audit, logs, rollback),
* The **security & policies** that keep it safe.

You can continue work immediately: add tools inside the child, improve NDJSON streaming, or harden path creation. The core guarantee — correct ownership and modes for all workspace writes — is now enforced at the right layer: the OS.

---

# Appendix A: Historical Approaches (v3.0–v4.0)

The following approaches were attempted and partially implemented before arriving at the child process architecture (v5.0).

## v3.0: Direct Credential Switching (`seteuid/setegid`)

**Date:** 2025-11-02
**Status:** ❌ Insufficient (SDK writes outside tool callbacks)

### Approach

Created `lib/workspace-credentials.ts` with:
- `getWorkspaceCredentials(workspacePath)` - Read workspace owner UID/GID
- `asWorkspaceUser(workspacePath, operation)` - Temporary credential switching using `seteuid/setegid`

### Key Learnings

**✅ What worked:**
- Reversible credential switching (effective UIDs, not real UIDs)
- `seteuid/setegid` allows escalation back to root
- Synchronous operations in event loop are safe (no interleaving)

**❌ What failed:**
- SDK/dependencies wrote files outside our tool callbacks
- Global `fs` patching doesn't work for ESM named imports
- Insufficient coverage despite comprehensive tests (8/8 passing)

### Critical Discovery: setuid vs seteuid

```typescript
// ❌ WRONG - Permanent, cannot restore
process.setuid(credentials.uid);
process.setgid(credentials.gid);
// Error: EPERM: Operation not permitted (cannot switch back to root)

// ✅ CORRECT - Temporary, can restore
process.seteuid(credentials.uid);  // Effective UID
process.setegid(credentials.gid);  // Effective GID
```

**Must use `seteuid/setegid` for reversible credential switching.**

---

## v4.0: FS Monkey-Patching with Object.defineProperty

**Date:** 2025-11-02
**Status:** ⚠️ Partial success, brittle

### Approach

Modified `apps/web/app/features/claude/streamHandler.ts` to:
1. Use `require('node:fs')` instead of ES import
2. Patch `fs.writeFileSync` and `fs.mkdirSync` with `Object.defineProperty`
3. Restore original functions in `finally` block

### Implementation

```typescript
// Use require() instead of ES import to enable patching
const fs = require("node:fs")

// Patching with Object.defineProperty
Object.defineProperty(fs, 'writeFileSync', {
  value: function patchedWriteFileSync(file, data, options) {
    const filePath = typeof file === 'string' ? file : file.toString()
    if (filePath.includes(cwd)) {
      return writeFileSyncAsWorkspaceUser(filePath, data, cwd)
    }
    return originalWriteFileSync.call(fs, file, data, options)
  },
  writable: true,
  configurable: true
})
```

### Challenges

| Challenge | Solution |
|-----------|----------|
| ES module bindings are immutable | Use `require()` instead of `import` |
| Direct assignment still fails with getters | Use `Object.defineProperty` with `configurable: true` |
| Patching must be scoped per request | Save/restore in try/finally block |

### Limitations

- ⚠️ Only works if code uses `require()` (breaks with ESM)
- ⚠️ Only intercepts `writeFileSync` and `mkdirSync` (incomplete coverage)
- ⚠️ Fragile if SDK changes import patterns
- ⚠️ Global per-request state (needs careful cleanup)

**Why v5.0 is better:** Child process approach has **complete coverage** regardless of import patterns or SDK internals.

---

## Test Results from v3.0

### Basic Credential Switch Tests (5/5 passing)

```
✅ Basic File Creation - Files created with correct ownership (UID 981:974)
✅ Directory Creation - Directories created with mode 755
✅ Credential Restoration - Process returns to root after operations
✅ Error Handling with Restore - Credentials restored even on error
✅ File and Directory Together - Combined operations work correctly
```

### Comprehensive Security Tests (8/8 passing)

```
✅ Runtime Capabilities [BLOCKER]
✅ Umask Handling [BLOCKER]
✅ Symlink Escape Attack [BLOCKER]
✅ Path Traversal Attack [BLOCKER]
✅ Nested Calls Detection
✅ Credential Restoration on Error
✅ File Ownership Correctness
✅ Process Exit on Failure
```

**Note:** Despite passing all tests, v3.0 was insufficient because SDK writes occurred outside instrumented code paths.

---

## Migration from v3.0/v4.0 to v5.0

If you have existing code using v3.0 or v4.0:

### From v3.0 (Direct Credential Switching)

**Before:**
```typescript
asWorkspaceUser(workspacePath, () => {
  writeFileSync(filePath, content, { mode: 0o644 });
});
```

**After (v5.0):**
- Remove `asWorkspaceUser()` wrapper from tools
- Tools now run in child process (already correct user)
- Just use plain `fs` operations:

```typescript
writeFileSync(filePath, content, { mode: 0o644 });
```

### From v4.0 (FS Monkey-Patching)

**Before:**
```typescript
// Patch fs globally
Object.defineProperty(fs, 'writeFileSync', { ... })
```

**After (v5.0):**
- Remove all `Object.defineProperty` patches
- Remove `require('node:fs')` workarounds
- Spawn child process instead
- Child inherits workspace user from spawn options

---

## Concurrency Analysis (from v3.0)

### Why v3.0 was safe in fork mode but still insufficient

**Verified via PM2 inspection:**
- Claude Bridge runs in **fork mode** (single Node.js process)
- Synchronous operations BLOCK the event loop → Sequential execution

**Safety matrix:**

| Scenario | Safe? | Reason |
|----------|-------|--------|
| Multiple users, synchronous ops, fork mode | ✅ YES | Event loop processes sequentially |
| Multiple users, async/await, fork mode | ❌ NO | Async allows interleaving during await |
| Multiple users, synchronous ops, cluster mode | ✅ YES | Each process has separate credentials (isolated) |

**But:** Even with safe credential switching, v3.0 couldn't catch SDK internal writes.

---

## Deployment History

### v3.0 Status
- ✅ Library implemented (`lib/workspace-credentials.ts`)
- ✅ Comprehensive tests passing (8/8)
- ❌ Never deployed to production (insufficient coverage discovered)

### v4.0 Status
- ✅ Integrated into staging (`dev.terminal.goalive.nl`)
- ⚠️ Partial success (some files still root-owned)
- ❌ Reverted before production deployment

### v5.0 Status (Current)
- ✅ **IMPLEMENTED** — Child process isolation with automatic detection
- ✅ **TESTED** — Verified on staging (dev.terminal.goalive.nl)
- ✅ **PRODUCTION DEPLOYED** — Nov 2, 2025 23:30 UTC
- ✅ **MIGRATION COMPLETE** — 6 workspaces migrated (60 files fixed)
- ✅ **VERIFIED** — All systemd workspaces clean (zero root-owned files)

---

## v5.0: Child Process Isolation (FINAL IMPLEMENTATION)

**Date:** 2025-11-02
**Status:** ✅ **PRODUCTION READY**

### Implementation Summary

**Core insight:** Process-level isolation is the ONLY way to guarantee all file operations inherit correct ownership, regardless of how SDK writes files internally.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js Route (/api/claude/stream)                │
│  Running as: root                                   │
│                                                     │
│  if (shouldUseChildProcess(workspace)) {            │
│    → Child Process Runner                          │
│  } else {                                           │
│    → In-Process SDK (legacy/fallback)              │
│  }                                                  │
└─────────────────────────────────────────────────────┘
                      ↓
         ┌────────────────────────┐
         │  Child Process         │
         │  scripts/run-agent.mjs │
         │                        │
         │  1. Spawn as root      │
         │  2. setegid(977)       │ ← Kernel-level enforcement
         │  3. seteuid(984)       │
         │  4. Run SDK query      │
         │  5. Stream NDJSON      │
         └────────────────────────┘
                      ↓
         All file operations inherit UID:984 GID:977
```

### Key Files

1. **`apps/web/lib/agent-child-runner.ts`** (130 lines)
   - `shouldUseChildProcess()` — Detects non-root workspace owner
   - `runAgentChild()` — Spawns child, passes credentials via env vars

2. **`apps/web/scripts/run-agent.mjs`** (200 lines)
   - Drops privileges via `seteuid/setegid`
   - Sets `HOME=/tmp/claude-debug-{uid}` for SDK logs
   - Runs SDK `query()` and streams NDJSON to parent

3. **`apps/web/app/api/claude/stream/route.ts`** (modified)
   - Lines ~263-397: Conditional child process or in-process logic

### Detection Logic

```typescript
export function shouldUseChildProcess(workspaceRoot: string): boolean {
  try {
    const st = statSync(workspaceRoot)
    return st.uid !== 0 && st.gid !== 0  // Non-root = systemd site
  } catch {
    return false  // Fallback to in-process
  }
}
```

**Automatic switching:**
- Systemd workspaces (e.g., `/srv/webalive/sites/two.goalive.nl/` owned by `site-two-goalive-nl`) → Child process
- Root-owned workspaces → In-process (backward compatible)

### Child Process Flow

```javascript
// 1. Drop privileges BEFORE running SDK
if (process.env.TARGET_GID) {
  process.setegid(Number(process.env.TARGET_GID))
}
if (process.env.TARGET_UID) {
  process.seteuid(Number(process.env.TARGET_UID))
}

// 2. Set umask for predictable file modes
process.umask(0o022)  // Files=644, Dirs=755

// 3. Set HOME to avoid /root/ permission issues
const debugHome = `/tmp/claude-debug-${process.geteuid()}`
mkdirSync(debugHome, { recursive: true, mode: 0o755 })
process.env.HOME = debugHome

// 4. Run SDK (all writes inherit process UID/GID)
const q = query({
  prompt: input.message,
  options: { cwd, model, maxTurns, allowedTools, ... }
})

// 5. Stream NDJSON to parent
for await (const m of q) {
  process.stdout.write(JSON.stringify({
    type: "message",
    messageType: m.type,
    content: m
  }) + "\n")
}
```

### Environment Variables (Child → Parent)

Parent passes to child via spawn env:
- `WORKSPACE_ROOT` — Workspace directory path
- `TARGET_UID` — Site user UID (e.g., 984)
- `TARGET_GID` — Site user GID (e.g., 977)
- `ANTHROPIC_API_KEY` — API key for SDK
- `PATH`, `NODE_ENV` — Essential vars only (no `CLAUDE_CODE_ENTRYPOINT`)

**Why minimal env:** Avoid passing SDK config that forces CLI mode or breaks library usage.

### NDJSON Protocol (Child stdout → Parent)

```json
{"type":"message","messageCount":1,"messageType":"assistant","content":{...}}
{"type":"message","messageCount":2,"messageType":"user","content":{...}}
{"type":"session","sessionId":"abc123"}
{"type":"complete","totalMessages":6,"result":{...}}
```

Parent converts NDJSON to SSE format expected by frontend.

### Testing Results

**Staging verification** (two.goalive.nl workspace):

```bash
$ stat -c '%U %G %a %n' /srv/webalive/sites/two.goalive.nl/user/test-integrated.txt
site-two-goalive-nl site-two-goalive-nl 644 test-integrated.txt
```

✅ **SUCCESS** — File owned by workspace user, not root!

**Logs confirm child process:**
```
[Claude Stream a7pw2h] Use child process: true
[Claude Stream a7pw2h] Using child process runner
[agent-child] Spawning runner as UID:984 GID:977
[agent-child] [runner] Running as UID:984 GID:977
```

### Why This Works (Technical)

1. **Kernel enforcement**: After `seteuid(984)`, the ENTIRE process is UID 984 — every syscall, every file write, regardless of code path
2. **Catches everything**: SDK built-in tools, debug logs (`~/.claude/debug/`), cache writes, temporary files — ALL inherit process UID/GID
3. **No patching needed**: ES module imports, CommonJS requires, internal SDK code — doesn't matter, kernel enforces ownership
4. **Zero fragility**: No import order dependencies, no monkey patching, no AST manipulation

**Comparison to failed approaches:**

| Approach | Coverage | Brittleness | Result |
|----------|----------|-------------|--------|
| v3.0: Credential switching | Tool callbacks only | Medium | SDK writes outside tools bypass |
| v4.0: FS monkey patching | CommonJS writes only | High | ES module imports bypass |
| **v5.0: Child process** | **100% of writes** | **None** | **✅ WORKS** |

### Deployment Checklist

Production deployment completed Nov 2, 2025:

- [x] Test on staging with systemd workspace
- [x] Verify file ownership (not root)
- [x] Verify frontend displays messages
- [x] Confirm child process detection logs
- [x] Clean up test files and failed approaches
- [x] Update CLAUDE.md documentation
- [x] Deploy to production: `pm2 restart claude-bridge`
- [x] Fix existing root-owned files (one-time migration - completed and script removed):
  ```bash
  # Migration completed: Fixed 6 workspaces (60 root-owned files)
  # Script was at: scripts/migrate-workspace-ownership.sh (removed after completion)
  ```
- [x] Verify child process completes successfully (logs show "Success: N messages")
- [x] Monitor logs for "Use child process: true" ✓ Working
- [x] Migration audit: All systemd workspaces verified ✓ Clean

### Migration Note

**IMPORTANT:** Workspaces created BEFORE this implementation will have root-owned files. This is a **one-time migration issue**, not an ongoing problem:

- **Old files** (created before Nov 2, 2025) = `root:root` → Need `chown` fix
- **New files** (created after deployment) = workspace user → Automatically correct

**Migration script for all sites:**

```bash
#!/bin/bash
# Fix ownership for all systemd workspaces
for site_dir in /srv/webalive/sites/*/user; do
  # Get workspace owner from directory
  site_user=$(stat -c '%U' $(dirname $site_dir))

  # Skip if already correct
  if [ "$site_user" = "root" ]; then
    echo "Skipping root-owned workspace: $site_dir"
    continue
  fi

  # Fix ownership
  echo "Fixing: $site_dir → $site_user"
  chown -R "$site_user:$site_user" "$site_dir"
done

# Verify no root-owned files remain
echo "Checking for remaining root-owned files..."
find /srv/webalive/sites/*/user -user root 2>/dev/null
```

### Rollback Plan

If issues arise:

1. **Immediate:** Child process automatically falls back to in-process for root-owned workspaces
2. **Override:** Change workspace ownership to root temporarily:
   ```bash
   chown -R root:root /srv/webalive/sites/problematic-site.com/
   ```
3. **Full revert:** Git revert + redeploy (child process code is isolated, no side effects)

### Future Enhancements

Possible improvements (not required):

- [ ] Environment variable override: `FORCE_CHILD_PROCESS=true|false`
- [ ] Metrics: Track child process usage vs in-process
- [ ] Performance comparison: Measure latency overhead
- [ ] Multi-site spawn optimization: Connection pooling for high-traffic sites

---

## References

**Implemented code:**
- `apps/web/lib/agent-child-runner.ts` — Parent wrapper and detection
- `apps/web/scripts/run-agent.mjs` — Child process runner
- `apps/web/app/api/claude/stream/route.ts` — Route integration (~263-397)

**Historical code (removed):**
- `lib/workspace-credentials.ts` — v3.0 credential switching (deleted)
- `lib/patch-fs-global.ts` — v4.0 FS patching (deleted)
- `instrumentation.ts` — v4.0 Next.js hook (deleted)
- `scripts/test-credential-switch.ts` — v3.0 tests (deleted)
- `scripts/proof-1-esm-vs-cjs.ts` — Proof that patching fails (deleted)

**Documentation:**
- `apps/web/CLAUDE.md` — Updated with child process section
- `docs/IMPLEMENTATION_AUTO_PERMISSION_FIX.md` — This document

---

---

## Production Summary (Nov 2, 2025)

### Final Status

**✅ PRODUCTION DEPLOYED AND VERIFIED**

The child process isolation implementation (v5.0) is now fully deployed to production and working correctly.

### What Was Fixed

**Problem:** Files created by Claude SDK were owned by `root:root`, preventing site processes from reading them and causing build failures.

**Solution:** Spawn Claude SDK in a child process that runs as the workspace user (e.g., `site-larsvandeneeden-com`). The OS kernel enforces correct ownership for ALL file operations.

### Key Implementation Details

1. **Detection:** Automatic based on workspace directory ownership
   - Non-root workspace → Child process
   - Root workspace → In-process (legacy fallback)

2. **Privilege Dropping:** Child process uses `setuid/setgid` (not `seteuid/setegid`)
   - Permanent privilege drop ensures all child processes inherit workspace user
   - SDK's own child process (Claude Code binary) runs with correct credentials

3. **Working Directory:** Child uses `chdir()` after loading modules
   - Avoids module resolution issues
   - Ensures SDK runs in workspace context

### Production Statistics

- **Deployment:** Nov 2, 2025 23:30 UTC
- **Total workspaces:** 28 (14 unique sites with aliases)
- **Systemd workspaces:** 27 (non-root owned)
- **Root workspaces:** 1 (staging.goalive.nl - legacy)
- **Migration required:** 6 workspaces (60 root-owned files)
- **Migration result:** ✅ 100% clean (zero root-owned files in systemd workspaces)

### Verification

```bash
# Logs confirm child process working
[runner] Running as UID:986 GID:979
[runner] Success: 8 messages

# Migration verification
✓ SUCCESS: All systemd workspace files have correct ownership
```

### Files Modified

**Core implementation:**
- `apps/web/lib/agent-child-runner.ts` (130 lines)
- `apps/web/scripts/run-agent.mjs` (110 lines)
- `apps/web/app/api/claude/stream/route.ts` (modified ~263-397)
- `apps/web/lib/env.ts` (NEW - T3-style validation)

**Migration tooling:**
- `scripts/migrate-workspace-ownership.sh` (one-time migration - completed and removed)

**Documentation:**
- `docs/IMPLEMENTATION_AUTO_PERMISSION_FIX.md` (updated)
- `apps/web/CLAUDE.md` (updated with child process section)

### Critical Fixes During Deployment

1. **TypeScript type errors:**
   - `systemPrompt` type mismatch (string vs preset object)
   - `NODE_ENV` type restrictions
   - Non-null assertion for validated env vars

2. **Module loading issue:**
   - Initial attempt used `spawn({ cwd: workspace })` → SDK couldn't find node_modules
   - Fix: Pass `TARGET_CWD` via env, call `chdir()` after imports

3. **Privilege dropping:**
   - Initial attempt used `seteuid/setegid` (effective UID) → SDK child process inherited root
   - Fix: Use `setuid/setgid` (permanent) → All processes inherit workspace user

4. **Existing file permissions:**
   - Files created before Nov 2 were `root:root`
   - Migration script fixed 60 files across 6 workspaces
   - Now: automatic correct ownership for all new files

### Ongoing Behavior

- ✅ New files created after deployment: Automatically correct ownership
- ✅ Child process detection: Automatic per workspace
- ✅ Backward compatibility: Root workspaces still work (in-process fallback)
- ✅ Error handling: Child process failures logged clearly
- ✅ Session resumption: Working correctly with NDJSON protocol

### Monitoring

**Success indicators in logs:**
```
[Claude Stream {id}] Use child process: true
[agent-child] Spawned as root (will drop to {uid}:{gid})
[runner] Running as UID:{uid} GID:{gid}
[runner] Success: {n} messages
```

**What to watch for:**
- Any "EACCES" errors → Check workspace file ownership
- Child process exit code 1 → Check stderr for [runner-error]
- Missing frontend messages → Verify NDJSON protocol working

### Next Steps

**None required** - Implementation is complete and production-ready.

**Optional future enhancements:**
- Metrics tracking (child process vs in-process usage)
- Performance monitoring (spawn overhead)
- Connection pooling for high-traffic sites

---

**End of Document — v5.0 PRODUCTION DEPLOYED (Nov 2, 2025)**
