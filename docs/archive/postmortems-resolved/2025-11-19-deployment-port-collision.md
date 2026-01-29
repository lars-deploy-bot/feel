# Deployment Port Collision Bug

**Status**: ✅ FIXED - Global PORT removed, code fixes applied
**Discovered**: 2025-11-19
**Fixed**: 2025-11-19
**Affected**: All subdomain deployments via `/api/deploy-subdomain`
**Example**: saaslanding.alive.best deployment failed (now working)

---

## Problem Statement

New website deployments fail with "Service not listening on port X" error. The service starts successfully but listens on a different port than expected, causing deployment verification to fail.

**Symptoms**:
- Deployment assigns port 3465
- Service actually starts on port 3368
- Verification checks port 3465 → fails
- Site is partially deployed but inaccessible

---

## Root Causes

### 1. Global systemd Environment Pollution

**Issue**: `PORT=3356` is set globally in systemd's environment:

```bash
$ systemctl show-environment
LANG=en_US.UTF-8
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/snap/bin
PORT=3356  ← Affects ALL systemd services
```

**Impact**: Every new service inherits `PORT=3356`, overriding the intended port assignment.

**How it happened**: Someone (or some script) ran `systemctl set-environment PORT=3356` at some point.

### 2. Environment File Created After Service Starts

**Issue**: The deployment script creates `/etc/sites/{slug}.env` **after** starting the systemd service.

**Location**: `packages/deploy-scripts/src/orchestration/deploy.ts`

```typescript
// Line 145-148: Start service
await reloadSystemd()
await startService(serviceName)  // ← Starts WITHOUT env file

// Line 150-159: Verify service
await verifyService(serviceName)
await isPortListening(port)      // ← Checks wrong port

// Line 175-177: Create env file (TOO LATE!)
const envFile = resolve(ETC_SITES_DIR, `${slug}.env`)
await createEnvFile(envFile, domain, port)
```

**Impact**: Service starts without its dedicated environment file, falls back to global systemd environment.

### 3. No Verification That Assigned Port Is Free

**Issue**: `getOrAssignPort()` assigns ports incrementally from the registry but doesn't check if the port is actually free with `netstat`/`lsof`.

**Location**: `packages/deploy-scripts/src/ports/index.ts`

**Impact**: May assign a port that's already occupied by another process.

---

## Complete Deployment Flow (Current)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. API Call: POST /api/deploy-subdomain                            │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  { slug, email, password?, orgId?, siteIdeas, selectedTemplate }│
│ OUT: { ok, domain, port, chatUrl } | error                         │
│ FILE: apps/web/app/api/deploy-subdomain/route.ts                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Build Domain & Validate                                          │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  slug = "saaslanding"                                           │
│ OUT: fullDomain = "saaslanding.alive.best"                          │
│ CHECK: siteMetadataStore.exists(slug) → false (OK)                  │
│ CHECK: existsSync("/srv/webalive/sites/${fullDomain}") → false (OK) │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Call deploySite()                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  { domain: "saaslanding.alive.best", email, password?, orgId } │
│ FILE: apps/web/lib/deployment/deploy-site.ts                       │
│ CALLS: deploySiteLib() from @alive-brug/deploy-scripts             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. DNS Validation (orchestration/deploy.ts)                         │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  domain = "saaslanding.alive.best"                             │
│ CHECK: shouldSkipDNSValidation() → true (*.alive.best wildcard)    │
│ OUT: SKIP                                                           │
│ LINE: 72-74                                                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Port Assignment (ports/index.ts)                                 │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  domain = "saaslanding.alive.best"                             │
│ CHECK: loadDomainPasswords()["saaslanding.alive.best"] → NOT FOUND │
│ LOGIC: Find highest port in registry (3333-3999) → e.g., 3464      │
│ ASSIGN: port = 3465                                                 │
│ SAVE: domain-passwords.json["saaslanding.alive.best"] = {port:3465}│
│ OUT: port = 3465                                                    │
│ LINE: 77 (deploy.ts)                                                │
│ ⚠️  BUG: Does NOT check if 3465 is actually free!                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. User & Directory Setup                                           │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  domain = "saaslanding.alive.best"                             │
│ CREATE: User "site-saaslanding-alive-best" (UID/GID)               │
│ CREATE: Directory "/srv/webalive/sites/saaslanding.alive.best/"    │
│ COPY: Template → new directory                                      │
│ OUT: newSiteDir = "/srv/webalive/sites/saaslanding.alive.best/"    │
│ LINE: 79-84                                                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Generate Config (scripts/generate-config.js)                     │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  domain = "saaslanding.alive.best", port = 3465                │
│ GENERATE: vite.config.ts with port: 3465                            │
│ GENERATE: vite.config.docker.ts with port: 3465                     │
│ GENERATE: Caddyfile with reverse_proxy localhost:3465              │
│ OUT: Config files created                                           │
│ LINE: 90-107                                                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. Install Dependencies & Build                                     │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  newSiteDir                                                     │
│ RUN: sudo -u site-saaslanding-alive-best bun install               │
│ RUN: sudo -u site-saaslanding-alive-best bun run build             │
│ OUT: dist/ folder with built assets                                 │
│ LINE: 112-140                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 9. Start systemd Service                                            │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  serviceName = "site@saaslanding-alive-best.service"           │
│ RUN: systemctl daemon-reload                                        │
│ RUN: systemctl start site@saaslanding-alive-best.service           │
│ ⚠️  CRITICAL: /etc/sites/saaslanding-alive-best.env DOES NOT EXIST  │
│ READS: Global systemd environment → PORT=3356                       │
│ STARTS: bun run dev --port 3356 --host 0.0.0.0                     │
│ VITE: Tries 3356 → occupied → tries 3357, 3358... → settles on 3368│
│ OUT: Service running on port 3368 (WRONG!)                          │
│ LINE: 145-148                                                       │
│ 🔥 BUG #1: Env file not created yet                                 │
│ 🔥 BUG #2: Global PORT=3356 pollutes all services                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 10. Verify Service                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  serviceName = "site@saaslanding-alive-best.service"           │
│ WAIT: 3 seconds                                                     │
│ CHECK: systemctl is-active --quiet → YES (service is running)      │
│ OUT: Service active ✅                                               │
│ LINE: 150-152                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 11. Verify Port Listening                                           │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  port = 3465                                                    │
│ WAIT: 2 seconds                                                     │
│ CHECK: isPortListening(3465) → FALSE ❌                             │
│ ACTUAL: Service listening on 3368 (not 3465)                       │
│ THROW: DeploymentError("Service not listening on port 3465")       │
│ LINE: 154-159                                                       │
│ 💥 DEPLOYMENT FAILS HERE                                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 12. Create Environment File (NEVER REACHED)                         │
├─────────────────────────────────────────────────────────────────────┤
│ IN:  slug = "saaslanding-alive-best", domain, port = 3465          │
│ CREATE: /etc/sites/saaslanding-alive-best.env                      │
│ CONTENT: DOMAIN=saaslanding.alive.best\nPORT=3465                  │
│ OUT: Env file created (TOO LATE!)                                   │
│ LINE: 175-177                                                       │
│ 🔥 BUG #3: This happens AFTER service start (wrong order)           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Evidence

### 1. Global PORT in systemd

```bash
$ systemctl show-environment
PORT=3356
```

### 2. Missing Environment File

```bash
$ ls -la /etc/sites/saaslanding-alive-best.env
ls: cannot access '/etc/sites/saaslanding-alive-best.env': No such file or directory
```

### 3. Process Environment

```bash
$ cat /proc/1211782/environ | tr '\0' '\n' | grep PORT
PORT=3356
```

### 4. Service Started with Wrong Port

```bash
$ journalctl -u site@saaslanding-alive-best.service -n 20
Nov 19 15:43:53 site-saaslanding-alive-best[1211782]: $ vite --port "3356" --host "0.0.0.0"
Nov 19 15:43:55 site-saaslanding-alive-best[1211783]: Port 3356 is in use, trying another one...
...
Nov 19 15:43:55 site-saaslanding-alive-best[1211783]: ➜  Local:   http://localhost:3368/
```

### 5. Registry vs Reality

```bash
$ jq '.["saaslanding.alive.best"].port' /var/lib/claude-bridge/domain-passwords.json
3465

$ lsof -i :3465
# (no output - nothing listening)

$ lsof -i :3368 -n -P
node    1211783 site-saaslanding-alive-best   20u  IPv4 ... TCP *:3368 (LISTEN)
```

---

## Proposed Fixes

### Fix 1: Remove Global PORT Pollution

```bash
# Immediate fix (run on server)
systemctl unset-environment PORT

# Verify
systemctl show-environment | grep PORT  # Should return nothing

# Restart affected services
systemctl restart site@saaslanding-alive-best.service
```

### Fix 2: Reorder Environment File Creation

**File**: `packages/deploy-scripts/src/orchestration/deploy.ts`

**Change**: Move lines 175-177 to **before** line 145

```typescript
// BEFORE (wrong order):
await startService(serviceName)      // Line 148
// ... verify ...
await createEnvFile(envFile, ...)    // Line 177

// AFTER (correct order):
await createEnvFile(envFile, ...)    // Create env file FIRST
await startService(serviceName)      // Then start service
// ... verify ...
```

### Fix 3: Add Port Availability Check

**File**: `packages/deploy-scripts/src/ports/index.ts`

**Add check in `getOrAssignPort()`**:

```typescript
export async function getOrAssignPort(domain: string): Promise<number> {
  const registry = loadDomainPasswords()

  // If domain exists, return existing port
  if (registry[domain]?.port) {
    return registry[domain].port
  }

  // Find next available port
  const START_PORT = 3333
  const END_PORT = 3999

  // Get all used ports from registry
  const usedPorts = new Set(
    Object.values(registry)
      .map(entry => entry.port)
      .filter(p => p >= START_PORT && p <= END_PORT)
  )

  // Find first free port (both registry AND netstat check)
  let candidatePort = START_PORT
  if (usedPorts.size > 0) {
    const maxPort = Math.max(...Array.from(usedPorts))
    candidatePort = maxPort + 1
  }

  while (candidatePort <= END_PORT) {
    const isUsed = usedPorts.has(candidatePort)
    const isListening = await isPortListening(candidatePort)  // ← ADD THIS

    if (!isUsed && !isListening) {
      await saveDomainPort(domain, candidatePort)
      return candidatePort
    }

    candidatePort++
  }

  throw new Error(`No available ports in range ${START_PORT}-${END_PORT}`)
}
```

### Fix 4: Add Retry Logic for Port Verification

**File**: `packages/deploy-scripts/src/orchestration/deploy.ts`

**Change line 154-159**:

```typescript
// Before (single check):
await delay(2000)
if (!(await isPortListening(port))) {
  throw new DeploymentError(`Service not listening on port ${port}`)
}

// After (retry with backoff):
await delay(2000)
let retries = 3
while (retries > 0) {
  if (await isPortListening(port)) {
    console.log(`[Deploy] ✅ Service listening on port ${port}`)
    break
  }
  retries--
  if (retries === 0) {
    const logs = execSync(`journalctl -u ${serviceName} --lines=20`).toString()
    throw new DeploymentError(`Service not listening on port ${port}\n${logs}`)
  }
  console.log(`[Deploy] Port ${port} not ready, retrying... (${retries} attempts left)`)
  await delay(2000)
}
```

---

## Implementation Plan

### Phase 1: Immediate Mitigation (5 min)

1. **Remove global PORT pollution**:
   ```bash
   systemctl unset-environment PORT
   systemctl show-environment | grep PORT  # verify
   ```

2. **Restart failed deployment**:
   ```bash
   systemctl restart site@saaslanding-alive-best.service
   ```

### Phase 2: Code Fixes (30 min)

1. **Fix environment file ordering** (`orchestration/deploy.ts`)
2. **Add port availability check** (`ports/index.ts`)
3. **Add retry logic** (`orchestration/deploy.ts`)
4. **Test with new deployment**

### Phase 3: Validation (15 min)

1. Deploy a new test site (e.g., `test-port-fix.alive.best`)
2. Verify port assignment matches actual listening port
3. Check environment file exists before service start
4. Confirm no global PORT in systemd environment

---

## Testing Checklist

- [ ] `systemctl show-environment` has no PORT variable
- [ ] New deployment assigns next available port (e.g., 3466)
- [ ] Environment file `/etc/sites/{slug}.env` created before service start
- [ ] Service listens on assigned port (verified with `lsof -i :PORT`)
- [ ] Caddy proxies to correct port
- [ ] Site accessible via HTTPS
- [ ] No "Port X is in use" messages in logs

---

## Related Files

- `apps/web/app/api/deploy-subdomain/route.ts` - API endpoint
- `apps/web/lib/deployment/deploy-site.ts` - Wrapper
- `packages/deploy-scripts/src/orchestration/deploy.ts` - Main logic (NEEDS FIX)
- `packages/deploy-scripts/src/ports/index.ts` - Port assignment (NEEDS FIX)
- `packages/deploy-scripts/src/files/index.ts` - Env file creation
- `/etc/systemd/system/site@.service` - Service template
- `/var/lib/claude-bridge/domain-passwords.json` - Port registry

---

## Impact Assessment

**Severity**: CRITICAL
**Affected Users**: All users attempting subdomain deployments
**Workaround**: Manual intervention (fix env file, restart service, update Caddy)
**Estimated Fix Time**: 1 hour (including testing)

---

## Notes

- The global PORT=3356 likely came from a manual `systemctl set-environment` command during debugging
- This bug demonstrates the importance of checking ACTUAL system state (netstat) vs REGISTRY state
- Environment file ordering is critical for systemd services with per-instance configuration
- Vite's auto-increment port behavior masked the root cause, making debugging harder
