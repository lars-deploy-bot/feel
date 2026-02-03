# Postmortem: components.alive.best - Host Blocking and Blank Page Issues

**Date**: November 10, 2025
**Incident**: components.alive.best returning 403 Forbidden, then blank page after initial fix
**Duration**: ~30 minutes
**Status**: Resolved

## Summary

The website `components.alive.best` was inaccessible due to a cascade of three distinct issues:
1. **File Permission Errors** - Files owned by root instead of dedicated systemd user
2. **Vite Host Blocking (403)** - Conflicting Vite configuration files with missing `allowedHosts`
3. **React Hook Errors (Blank Page)** - Multiple React copies in dependency tree

Each issue was discovered and resolved sequentially. The incident demonstrates the importance of proper file ownership in systemd deployments and the pitfalls of configuration file conflicts.

## Timeline

### Phase 1: Host Blocking (403 Forbidden)
1. **15:30** - User reports: "Blocked request. This host is not allowed"
2. **15:31** - Checked service status: Permission denied errors in logs
3. **15:32** - Discovered files owned by `root:root` instead of `site-components-alive-best`
4. **15:34** - Fixed ownership with `chown -R site-components-alive-best:site-components-alive-best`
5. **15:35** - Service restarted but still returning 403 Forbidden

### Phase 2: Configuration File Conflict
6. **15:36** - Discovered two Vite config files: `vite.config.js` and `vite.config.ts`
7. **15:37** - Found `vite.config.js` missing `allowedHosts` configuration
8. **15:37** - Deleted incorrect `vite.config.js`, kept correct `vite.config.ts`
9. **15:37** - Service restarted, now returning HTTP 200

### Phase 3: Blank Page (React Duplicate Dependencies)
10. **15:38** - User reports: Site loads but shows blank page
11. **15:39** - Browser console reveals: "Invalid hook call" and "Cannot read properties of null"
12. **15:40** - Identified multiple React copies in dependency tree
13. **15:40** - Cleaned all `node_modules` and lock files
14. **15:40** - Fresh install with `bun install --force`
15. **15:40** - Site fully functional after hard refresh

## Root Causes

### Issue #1: File Permission Problems

**What Happened:**
Files in `/srv/webalive/sites/components.alive.best/` were owned by `root:root` instead of the dedicated systemd user.

**Evidence:**
```bash
$ systemctl status site@components-alive-best.service
Cannot read file "../node_modules/react-dom/node_modules/react/package.json": permission denied
Cannot read file "../node_modules/react-dom/node_modules/react/index.js": permission denied

$ ls -la /srv/webalive/sites/components.alive.best/user/vite.config.ts
-rw-r--r-- 1 root root 579 Nov 10 15:34 vite.config.ts
```

**Why It Happened:**
- **DEPLOYMENT SCRIPT BUG**: Config generation runs as root AFTER initial `chown`
- Line 268: `bun run scripts/generate-config.js` executes as root (no `sudo -u`)
- Creates/modifies `vite.config.ts` with root ownership after ownership "fix"
- Additionally, manual file edits as root can compound the problem
- systemd service runs as `site-components-alive-best` user for security isolation
- User couldn't read its own files due to root ownership

**Impact:**
- Service couldn't start properly
- Vite couldn't read node_modules dependencies
- Build process failed with permission errors

### Issue #2: Conflicting Vite Configuration Files

**What Happened:**
Two Vite configuration files existed with different configurations:

```javascript
// vite.config.js (WRONG - used by Vite due to precedence)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000  // Missing allowedHosts!
  }
})
```

```typescript
// vite.config.ts (CORRECT - ignored due to .js taking precedence)
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3364,
    allowedHosts: ["components.alive.best"],  // ✅ Needed for proxy
  },
  // ... proper configuration
}))
```

**Why It Happened:**
- `.js` file likely created manually or from old template
- Deployment script generates correct `.ts` file
- Vite prioritizes `.js` over `.ts` when both exist
- Old `.js` file never cleaned up

**Technical Details - DNS Rebinding Protection:**
Vite's dev server blocks requests with unexpected `Host` headers to prevent DNS rebinding attacks. By default, only `localhost` is allowed. When Caddy proxies requests with `Host: components.alive.best`, Vite needs explicit permission via `allowedHosts`.

**Flow Without allowedHosts:**
```
Browser → Caddy → Vite Dev Server
           ↓
  Host: components.alive.best
           ↓
  Vite: "Not in allowedHosts!"
           ↓
       403 Forbidden
```

**Impact:**
- HTTP 403 Forbidden for all requests
- Service appeared healthy in systemd logs
- Caddy proxy worked correctly but Vite rejected requests

### Issue #3: React Duplicate Dependencies (Blank Page)

**What Happened:**
Multiple copies of React existed in the dependency tree, causing React Hooks to fail.

**Evidence:**
```
Browser Console:
Invalid hook call. Hooks can only be called inside of the body of a function component.
Cannot read properties of null (reading 'useEffect')
```

**Why It Happened:**
- Some packages (`@tanstack/react-query`, Radix UI) can bundle nested React
- Incremental `bun install` doesn't always deduplicate properly
- Old `node_modules` had multiple React instances

**Technical Details - React Singleton Pattern:**
React Hooks rely on a singleton pattern. When multiple React instances exist:
1. App uses React instance A
2. Dependency uses React instance B
3. Hooks from B try to access state from A
4. Result: `null` errors because state doesn't exist in the other instance

**Dependency Tree Example:**
```
node_modules/
├── react/                           # Instance A (18.3.1)
├── react-dom/
│   └── node_modules/
│       └── react/                   # Instance B (18.3.1) - DUPLICATE!
└── @tanstack/react-query/
    └── node_modules/
        └── react/                   # Instance C (18.3.1) - DUPLICATE!
```

**Impact:**
- HTML loaded successfully
- CSS applied correctly
- JavaScript loaded but React failed to mount
- Blank white page with errors in console

## What Went Wrong

### Process Issues
1. **Deployment Script Bug** - Config generation ran as root after initial ownership fix
2. **Manual File Editing as Root** - Can compound the ownership problem
3. **No Config File Cleanup** - Old `.js` file lingered after deployment
4. **Incremental Dependency Updates** - Failed to deduplicate React properly

### Code Issues
1. **Ownership Applied Too Early** - `chown` before config generation, not after
2. **Config Generation as Root** - No `sudo -u` wrapper for config script
3. **Multiple Config Files** - No validation for conflicting configs
4. **Relative Priority** - Vite's `.js` > `.ts` precedence not documented
5. **Missing Validation** - Deployment script doesn't verify final ownership

### Detection Issues
1. **Permission errors hidden** - Initial focus on 403, not logs
2. **Config conflict not obvious** - Required file listing to discover
3. **Dependency issues silent** - Only visible in browser console

## What Went Right

### Quick Root Cause Identification
- Systematic debugging approach
- Checked service logs immediately
- Used browser console for client-side errors
- Sequential problem solving (one issue at a time)

### Proper Investigation Tools
```bash
# File ownership check
ls -la /srv/webalive/sites/components.alive.best/user/

# Service logs
journalctl -u site@components-alive-best.service -n 50

# Config file discovery
ls -la /srv/webalive/sites/components.alive.best/user/vite.config.*

# Browser console for client errors
F12 → Console → React Hook errors
```

### Clean Resolution
- Fixed each issue completely before moving to next
- Used correct user for all operations
- Full dependency reinstall for clean state
- Verified each fix with service restart

## Resolution

### 1. Fixed File Ownership
```bash
# Change ownership to systemd service user
chown -R site-components-alive-best:site-components-alive-best \
  /srv/webalive/sites/components.alive.best

# Restart service
systemctl restart site@components-alive-best.service
```

**Verification:**
```bash
$ ls -la /srv/webalive/sites/components.alive.best/
drwxr-x--- 6 site-components-alive-best site-components-alive-best ...
```

### 2. Removed Conflicting Vite Config
```bash
# Delete incorrect .js file
rm /srv/webalive/sites/components.alive.best/user/vite.config.js

# Verify .ts file has correct config
grep "allowedHosts" /srv/webalive/sites/components.alive.best/user/vite.config.ts
# Output: allowedHosts: ["components.alive.best"],

# Restart service to reload config
systemctl restart site@components-alive-best.service
```

**Verification:**
```bash
$ curl -I https://components.alive.best
HTTP/2 200  # ✅ No longer 403
```

### 3. Cleaned React Dependencies
```bash
# Remove ALL node_modules (parent and user)
rm -rf /srv/webalive/sites/components.alive.best/node_modules
rm -rf /srv/webalive/sites/components.alive.best/user/node_modules
rm -rf /srv/webalive/sites/components.alive.best/bun.lock

# Fresh install with deduplication
cd /srv/webalive/sites/components.alive.best/user
sudo -u site-components-alive-best bun install --force

# Restart service
systemctl restart site@components-alive-best.service
```

**Verification:**
```bash
# Only one React instance exists
$ find /srv/webalive/sites/components.alive.best/user/node_modules \
  -name "package.json" -path "*/react/package.json" | wc -l
1  # ✅ Single React instance

# Browser console: No errors
# Page renders: Component Library visible
```

## Prevention Measures

### 1. File Ownership Enforcement (FIXED)

**Root Cause in Deployment Script:**
```bash
# BEFORE (BUGGY):
# Line 240: chown -R "$USER:$USER" "$NEW_SITE_DIR"  # Fix ownership
# Line 268: bun run scripts/generate-config.js       # Runs as ROOT! ❌
# Result: Config files created with root ownership after chown

# AFTER (FIXED):
# Line 240: chown -R "$USER:$USER" "$NEW_SITE_DIR"  # Initial fix
# Line 268: bun run scripts/generate-config.js       # Still runs as root
# Line 277: chown -R "$USER:$USER" "$NEW_SITE_DIR"  # Fix again! ✅
# Result: All files have correct ownership
```

**Deployment Script Fix Applied:**
```bash
# deploy-site-systemd.sh - Lines 274-277
# 10.5. CRITICAL: Fix ownership again after config generation
# Config generation may create new files as root, so re-apply ownership
echo "🔒 Fixing file ownership after config generation..."
chown -R "$USER:$USER" "$NEW_SITE_DIR"
```

**Additional Verification:**
```bash
# Add ownership verification at end of deployment
if [ "$(stat -c '%U' "$NEW_SITE_DIR/user")" != "$USER" ]; then
    echo "❌ File ownership verification failed"
    exit 20
fi
```

**User Guide Addition:**
```markdown
⚠️ CRITICAL: When editing site files, ALWAYS use the correct user:

# Correct (preserves ownership)
sudo -u site-domain-slug nano /srv/webalive/sites/domain/file.ts

# Wrong (changes to root ownership)
sudo nano /srv/webalive/sites/domain/file.ts
```

### 2. Vite Config Cleanup

**Deployment Script Enhancement:**
```bash
# Add to deploy-site-systemd.sh after file copy
echo "🧹 Cleaning up conflicting config files..."

# Remove any .js configs if .ts exists
if [ -f "$NEW_SITE_DIR/user/vite.config.ts" ]; then
    rm -f "$NEW_SITE_DIR/user/vite.config.js"
    echo "✅ Removed conflicting vite.config.js"
fi
```

**Config Validation:**
```bash
# Verify allowedHosts is present
if ! grep -q "allowedHosts" "$NEW_SITE_DIR/user/vite.config.ts"; then
    echo "⚠️ Warning: allowedHosts not found in Vite config"
fi
```

### 3. Dependency Management Best Practices

**Clean Install on Deployment:**
```bash
# Add flag to deployment script
FORCE_CLEAN_INSTALL=${FORCE_CLEAN_INSTALL:-false}

if [ "$FORCE_CLEAN_INSTALL" = true ]; then
    echo "🧹 Force cleaning dependencies..."
    rm -rf "$NEW_SITE_DIR/user/node_modules"
    rm -f "$NEW_SITE_DIR/user/bun.lock"
fi
```

**React Deduplication Check:**
```bash
# After bun install, verify single React
REACT_INSTANCES=$(find "$NEW_SITE_DIR/user/node_modules" \
  -name "package.json" -path "*/react/package.json" | wc -l)

if [ "$REACT_INSTANCES" -gt 1 ]; then
    echo "⚠️ Warning: Multiple React instances detected ($REACT_INSTANCES)"
    echo "   Run with FORCE_CLEAN_INSTALL=true to fix"
fi
```

### 4. Health Check Enhancement

**Post-Deployment Verification:**
```bash
# Add comprehensive health check to deployment script
echo "🧪 Running post-deployment health checks..."

# 1. File ownership check
CHECK_OWNERSHIP=$(stat -c '%U' "$NEW_SITE_DIR/user")
if [ "$CHECK_OWNERSHIP" != "$USER" ]; then
    echo "❌ Health check failed: Wrong file ownership"
    exit 21
fi

# 2. Config file validation
if [ -f "$NEW_SITE_DIR/user/vite.config.js" ] && \
   [ -f "$NEW_SITE_DIR/user/vite.config.ts" ]; then
    echo "❌ Health check failed: Conflicting Vite configs"
    exit 22
fi

# 3. Service response check (with correct host header)
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Host: $DOMAIN" http://localhost:$PORT/)
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Health check failed: Got HTTP $HTTP_CODE instead of 200"
    exit 23
fi

echo "✅ All health checks passed"
```

## Testing Verification

The fix was validated through:

1. **File Permissions:**
   ```bash
   $ ls -la /srv/webalive/sites/components.alive.best/ | head -3
   drwxr-x--- site-components-alive-best site-components-alive-best
   ```

2. **Vite Configuration:**
   ```bash
   $ ls /srv/webalive/sites/components.alive.best/user/vite.config.*
   vite.config.ts  # ✅ Only .ts exists

   $ curl -I https://components.alive.best
   HTTP/2 200  # ✅ No longer 403
   ```

3. **React Dependencies:**
   ```bash
   $ find node_modules -name "package.json" -path "*/react/package.json"
   node_modules/react/package.json  # ✅ Single instance

   # Browser console: No errors
   # Page renders correctly
   ```

## Lessons Learned

### Technical Lessons

1. **File Ownership in Systemd Deployments**
   - Always verify ownership after any file operation
   - Use `sudo -u <user>` for all file modifications
   - Automated ownership checks prevent silent failures

2. **Configuration File Precedence Matters**
   - Vite prioritizes `.js` over `.ts` when both exist
   - Clean up old config files during deployment
   - Single source of truth for configuration

3. **React Dependency Deduplication**
   - Incremental installs can create duplicate React instances
   - Fresh `node_modules` install solves Hook errors
   - Use `bun install --force` for clean state

4. **Multi-Layer Debugging Required**
   - Server logs show permission/config issues
   - Browser console shows client-side React errors
   - Each layer needs separate investigation

### Process Lessons

1. **Sequential Problem Solving**
   - Fix one issue completely before investigating next
   - Verify each fix with restart and test
   - Multiple issues can have cascading effects

2. **Systematic Investigation**
   - Check service status and logs first
   - List configuration files for conflicts
   - Use browser console for client errors
   - Don't assume single root cause

3. **Proper User Context**
   - Always use correct systemd service user
   - Root operations break file ownership
   - Automated checks prevent manual mistakes

### Monitoring Lessons

1. **Permission Errors Are Silent**
   - 403 errors can mask permission problems
   - Logs reveal actual cause (permission denied)
   - Monitor file ownership in health checks

2. **Config Conflicts Hide**
   - Multiple config files not obvious
   - Need explicit file listing to discover
   - Validate single config during deployment

3. **Client Errors Need Browser Console**
   - Blank page = check browser console
   - React Hook errors indicate duplicates
   - Server logs won't show client issues

## Action Items

- [x] Fix file ownership for components.alive.best
- [x] Remove conflicting vite.config.js
- [x] Clean and reinstall React dependencies
- [x] Verify site renders correctly
- [x] Document this postmortem
- [x] **Fix deployment script ownership bug** - Added second `chown` after config generation
- [ ] Add file ownership validation to end of deployment script
- [ ] Add Vite config cleanup to deployment script
- [ ] Add React deduplication check to deployment
- [ ] Update deployment documentation with ownership warnings
- [ ] Create troubleshooting guide for blank page issues

## Future Considerations

### Deployment Script Hardening
- **File Ownership Validation** - Automated check after every file operation
- **Config File Cleanup** - Remove conflicting configs before service start
- **Dependency Health Check** - Verify single React instance post-install

### Monitoring & Alerts
- Alert on permission denied errors in systemd services
- Detect multiple config files during deployment
- Monitor for React Hook errors in browser logs

### Documentation Updates
- Add "Common Issues" section for blank pages
- Document Vite config file precedence
- Create guide for proper file editing (sudo -u)
- Add React dependency troubleshooting section

### Preventive Measures
```bash
# Consider adding to site maintenance script
#!/bin/bash
# scripts/site-health-check.sh

DOMAIN=$1
SLUG=${DOMAIN//[^a-zA-Z0-9]/-}
USER="site-${SLUG}"
SITE_DIR="/srv/webalive/sites/$DOMAIN"

echo "🔍 Health Check: $DOMAIN"

# 1. File ownership
WRONG_OWNER=$(find "$SITE_DIR" ! -user "$USER" 2>/dev/null | wc -l)
if [ "$WRONG_OWNER" -gt 0 ]; then
    echo "⚠️  Found $WRONG_OWNER files with wrong ownership"
fi

# 2. Config conflicts
if [ -f "$SITE_DIR/user/vite.config.js" ] && \
   [ -f "$SITE_DIR/user/vite.config.ts" ]; then
    echo "⚠️  Conflicting Vite config files detected"
fi

# 3. React duplicates
REACT_COUNT=$(find "$SITE_DIR/user/node_modules" \
  -name "package.json" -path "*/react/package.json" 2>/dev/null | wc -l)
if [ "$REACT_COUNT" -gt 1 ]; then
    echo "⚠️  Multiple React instances: $REACT_COUNT"
fi

echo "✅ Health check complete"
```

---

**Key Takeaways:**
1. File ownership issues in systemd deployments manifest as permission errors - always verify ownership
2. Multiple Vite config files cause precedence conflicts - clean up old configs during deployment
3. React Hook errors ("Invalid hook call") indicate duplicate React dependencies - requires clean reinstall
4. Multi-layer debugging is essential - check server logs, config files, and browser console separately
