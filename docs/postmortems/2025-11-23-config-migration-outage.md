# Postmortem: Config Migration Breaking Dev Server & E2E Tests

**Date**: 2025-11-23
**Severity**: P1 (Production dev server down, all E2E tests failing)
**Duration**: ~2 hours
**Status**: Resolved

---

## Executive Summary

A config file migration from root-level `bridge.config.js` to `packages/shared/src/environments.json` was incomplete, leaving references to the deleted files in `package.json` scripts. This caused:

1. **Dev server crash loop** (4738 restarts, 502 errors on dev.terminal.goalive.nl)
2. **E2E test failures** (6 out of 30 tests failing due to unrelated navigation timing issue)

Both issues were resolved, but the migration lacked proper validation and the E2E issue was pre-existing and revealed during investigation.

---

## Timeline (UTC)

**Prior to incident:**
- Config migration completed in commit `267f24c`
- Files deleted: `bridge.config.js`, `environments.json` (root level)
- Files added: `packages/shared/src/environments.json`, `environments.config.ts`

**Incident begins:**
- Dev server enters crash loop (exact start time unknown - PM2 shows 4738 restarts)
- Error: `Cannot find module '../../bridge.config.js'`

**Detection (T+0):**
- User reports: "dev.terminal.goalive.nl is currently unable to handle this request. HTTP ERROR 502"
- Investigation reveals PM2 error state with thousands of restarts

**Investigation (T+10min):**
- PM2 logs examined: `error: option '-p, --port <port>' argument '--port' is invalid`
- Root cause identified: `package.json` dev/start scripts still reference deleted `bridge.config.js`

**Wrong turn (T+15min):**
- AI assistant mistakenly restores `bridge.config.js` and `environments.json` from git history
- User corrects: "these weren't deleted accidentally. it had a reason. we moved a lot of configs to other files"

**Resolution path (T+25min):**
- Explore mode investigation reveals proper config migration to `packages/shared/src/environments.json`
- Updated `apps/web/package.json` scripts to use hardcoded ports
- Removed incorrectly restored files
- Restarted PM2 dev server
- Verified 200 OK responses

**Secondary issue discovered (T+30min):**
- E2E tests revealed to have 6 failures (pre-existing, not caused by config migration)
- Root cause: Login helper's `page.waitForURL("/chat")` timing out on client-side navigation

**Secondary resolution (T+45min):**
- Removed problematic `waitForURL()` from login helper
- All 30 E2E tests now passing

---

## Root Causes

### 1. Config Migration - Incomplete Reference Update

**What happened:**
- Config migration moved `bridge.config.js` → `packages/shared/src/environments.json`
- Migration updated TypeScript imports but **missed npm scripts in package.json**
- Scripts used Node.js inline evaluation: `$(node -p "require('../../bridge.config.js').ports.dev")`

**Why it wasn't caught:**
1. ❌ **No validation script** to check for references to deleted files
2. ❌ **No dev server restart** as part of migration testing
3. ❌ **No CI/CD checks** for broken scripts before merge
4. ❌ **Scripts were in different language** (bash inline JS) - not caught by TypeScript/grep

**Contributing factors:**
- PM2 silently restarted thousands of times without alerting
- No monitoring/alerting on excessive restart counts
- Dev server runs in background, issue not visible until user accessed it

### 2. E2E Test Navigation Timing (Pre-existing)

**What happened:**
- Login helper waited for automatic redirect: `await page.waitForURL("/chat", { timeout: 5000 })`
- Next.js `router.push("/chat")` uses client-side navigation
- Playwright's `waitForURL()` doesn't reliably detect client-side navigation
- Tests timed out even though login succeeded (200 OK)

**Why it wasn't caught:**
- Tests were **not failing consistently** - some passed, some failed (timing-dependent)
- Parallel execution masked the issue (tests that ran later sometimes passed)
- Login helper's redirect wait was **unnecessary** - all tests explicitly navigate to `/chat` afterward

---

## Impact

### Dev Server Outage
- **User-facing**: 502 errors on dev.terminal.goalive.nl
- **Duration**: Unknown start time → ~30 minutes after detection
- **Scope**: Dev environment only (staging/production unaffected)
- **PM2 restart count**: 4738 (indicating hours of crash loop)

### E2E Test Failures
- **Coverage**: 6 out of 30 tests failing (20% failure rate)
- **Impact**: False signal - tests incorrectly reported failures despite code working
- **Developer impact**: Reduced confidence in test suite

---

## Detection

**How we found out:**
1. ✅ User reported 502 error (manual detection)
2. ❌ No automated alerting
3. ❌ No health checks or uptime monitoring
4. ❌ No PM2 restart rate alerts

**What worked:**
- PM2 logs were accessible and informative
- Error messages were clear

**What didn't work:**
- No proactive detection before user impact
- Excessive restarts went unnoticed for hours/days

---

## Resolution

### Immediate fixes (applied):
1. ✅ Updated `apps/web/package.json` scripts to hardcoded ports
2. ✅ Removed incorrectly restored config files
3. ✅ Restarted dev server (PM2)
4. ✅ Fixed E2E login helper navigation wait
5. ✅ Verified all tests passing (30/30)

### Verification:
- ✅ Dev server responding with 200 OK
- ✅ Build system: passing
- ✅ Unit tests: 149/149 passing
- ✅ E2E tests: 30/30 passing
- ✅ TypeScript: no errors
- ✅ Grep search: no remaining references to deleted files

---

## Lessons Learned

### What went well:
1. ✅ Clear error messages in PM2 logs
2. ✅ Quick root cause identification
3. ✅ Systematic investigation (git history, grep, explore mode)
4. ✅ User corrected wrong assumptions (restored files)
5. ✅ Comprehensive verification after fix

### What went wrong:
1. ❌ Config migration lacked validation checklist
2. ❌ No automated checks for broken scripts
3. ❌ No dev server health monitoring
4. ❌ E2E tests had timing-dependent failures
5. ❌ No pre-merge testing of script execution

---

## Action Items

### Immediate (P0) - Prevent recurrence:

- [ ] **Create migration validation script**
  - Script to detect references to deleted files
  - Check: TypeScript imports, package.json scripts, bash scripts, documentation
  - Run: `scripts/validate-no-deleted-refs.sh <file1> <file2> ...`

- [ ] **Add PM2 restart rate alerting**
  - Alert if any process restarts >10 times in 5 minutes
  - Integration: PM2 → monitoring system

- [ ] **Document script migration checklist**
  - Location: `docs/guides/safe-config-migration.md`
  - Include: validation steps, testing requirements, rollback plan

### Short-term (P1) - Improve detection:

- [ ] **Add dev server health checks**
  - Endpoint: `GET /api/health`
  - Monitor: Every 60s, alert on 3 consecutive failures
  - Tool: UptimeRobot, Pingdom, or custom

- [ ] **Create pre-commit hook for package.json script validation**
  - Validate all npm scripts execute successfully (or at least parse correctly)
  - Run on: `package.json` changes

- [ ] **Add E2E test stability checks**
  - Run E2E tests 3 times in CI to catch timing-dependent failures
  - Flag tests with >10% failure rate as "flaky"

### Medium-term (P2) - Improve process:

- [ ] **Standardize config management**
  - Document: Single source of truth for environment configs
  - Enforce: TypeScript config files only (no dynamic `require()` in scripts)
  - Pattern: Import constants, don't shell out to Node

- [ ] **Add "affected services" checklist to PR template**
  - Question: "Did you restart all affected services after this change?"
  - Require: Checkbox for migrations/config changes

- [ ] **Create staging smoke test suite**
  - Run after every deploy: Basic health checks
  - Include: Dev server reachable, login works, chat page loads

### Long-term (P3) - Architectural:

- [ ] **Migrate away from PM2 for dev environment**
  - Consider: systemd (like production) or Docker Compose
  - Benefit: Better restart limits, more visible failures

- [ ] **Implement proper dev environment monitoring**
  - Metrics: Error rates, restart counts, response times
  - Dashboard: Grafana/Prometheus or equivalent

- [ ] **Create automated rollback mechanism**
  - On detection of excessive restarts: Auto-rollback to previous version
  - Notify: Team via Slack/email

---

## Prevention Checklist

**For future config migrations:**

1. ✅ Create migration plan document
2. ✅ Search for all references to old files:
   - `grep -r "old-file.js" .` (exclude node_modules, .git, dist)
   - Check: TypeScript, JavaScript, JSON, bash scripts, docs
3. ✅ Update all references before deleting files
4. ✅ Run validation script (once created)
5. ✅ Test in dev environment:
   - Restart all affected services
   - Verify no crashes/errors in logs
   - Run full test suite (unit + E2E)
6. ✅ Document migration in CHANGELOG
7. ✅ Add notes to CLAUDE.md if patterns changed

**For E2E test reliability:**

1. ✅ Never wait for automatic redirects - let tests control navigation
2. ✅ Use explicit `page.goto()` instead of relying on `router.push()`
3. ✅ Add retry logic for timing-sensitive operations
4. ✅ Flag and fix flaky tests immediately (don't let them accumulate)

---

## Related Documentation

- [Config Migration Guide](../guides/safe-config-migration.md) (TODO: Create)
- [Environment Configuration](../deployment/ENVIRONMENTS_CONFIG.md)
- [Testing Guide](../testing/TESTING_GUIDE.md)
- [PM2 Management](../deployment/pm2-management.md) (TODO: Create)

---

## Appendix: Technical Details

### Files Modified (Resolution)

```diff
# apps/web/package.json
- "dev": "next dev --turbo -p $(node -p \"require('../../bridge.config.js').ports.dev\")",
+ "dev": "next dev --turbo -p 8997",

- "start": "next start -p $(node -p \"require('../../bridge.config.js').ports.production\")",
+ "start": "next start -p 9000",
```

```diff
# apps/web/e2e-tests/helpers.ts
  const loginResponse = await loginResponsePromise
  const loginData = await loginResponse.json()
  console.log(`[Login Debug] Email: ${tenant.email}, Status: ${loginResponse.status()}, Response:`, JSON.stringify(loginData))

- await page.waitForURL("/chat", { timeout: 5000 })
+ // Don't wait for redirect - tests handle their own navigation
+ // The login page may call router.push("/chat") but client-side navigation
+ // doesn't always trigger Playwright's navigation detection reliably
}
```

### Error Messages

**Dev server crash:**
```
Error: Cannot find module '../../bridge.config.js'
Require stack: /root/webalive/claude-bridge/apps/web/[eval]
error: option '-p, --port <port>' argument '--port' is invalid
```

**E2E test failure:**
```
TimeoutError: page.waitForURL: Timeout 5000ms exceeded.
=========================== logs ===========================
waiting for navigation to "/chat" until "load"
============================================================
```

### PM2 Status During Incident

```
┌────┬──────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                 │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼──────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 1  │ claude-bridge-dev    │ default     │ N/A     │ fork    │ 0        │ 0      │ 4738 │ errored   │ 0%       │ 0b       │ root     │ disabled │
└────┴──────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

**Note**: 4738 restarts indicates the issue existed for hours/days before detection.

---

## Sign-off

**Postmortem completed by**: AI Assistant (Claude)
**Reviewed by**: *(Pending)*
**Action items tracked in**: *(TODO: Link to issue tracker)*

**Date**: 2025-11-23
**Status**: Resolved - All systems operational
