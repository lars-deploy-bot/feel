# Test Data Safety & Cleanup

## Critical Security Measures

We have **TRIPLE VERIFICATION** to prevent accidental deletion of real users:

### 1. Strict Internal Test Domains

Test users MUST use these internal domains (NEVER use for real users):
- `@bridge-vitest.internal` - For vitest integration tests
- `@bridge-playwright.internal` - For playwright E2E tests
- `@claude-bridge-test.local` - For other test scenarios

**❌ REMOVED** from allowed domains (too risky - real users might use these):
- `@test.com`
- `@example.com`
- `@localhost`
- `@test.local`

### 2. Explicit Test Marking

All test users are marked with `is_test_env = true` in the database.

### 3. No Pattern-Based Domain Deletion

**REMOVED**: Domain pattern matching (e.g., `tc*.alive.best`, `test-*.alive.best`)
- Too risky - real users might use similar patterns
- We ONLY delete domains via `org_id` association with test orgs

## Automatic Cleanup

### Daily Cleanup Timer

Runs automatically **every day at 3:00 AM**:

```bash
# Check status
systemctl status claude-bridge-cleanup.timer

# View next scheduled run
systemctl list-timers claude-bridge-cleanup.timer

# Run manually (for testing)
systemctl start claude-bridge-cleanup.service

# View logs
tail -f /var/log/claude-bridge-cleanup.log
```

### What Gets Deleted

Only when **ALL** conditions are met:
1. ✅ `is_test_env = true`
2. ✅ Email matches internal test domain
3. ✅ No real user patterns

Deleted items:
- Test user sessions
- Test organization invites
- Test domains (via org_id only)
- Test org memberships
- Orphaned organizations (zero members)
- Test users

### Manual Cleanup

**Manager UI** (Settings tab):
- **Preview Cleanup** button - Shows what would be deleted
- **Delete Test Data** button - Actually removes test data
- Shows statistics after running

**CLI**:
```bash
# Dry run (preview)
bun scripts/cleanup-test-database.ts

# Actually delete
bun scripts/cleanup-test-database.ts --force
```

## For Developers

### Creating Test Users

```typescript
import { createTestUser } from '@/lib/test-helpers/auth-test-helper'

// ✅ CORRECT - Uses internal domain
const user = await createTestUser() // auto-generates @bridge-vitest.internal

// ✅ CORRECT - Explicit internal domain
const user = await createTestUser('mytest@bridge-vitest.internal')

// ❌ WRONG - Will throw error
const user = await createTestUser('test@test.com')
```

### Cleanup After Tests

```typescript
import { cleanupTestUser } from '@/lib/test-helpers/auth-test-helper'

afterAll(async () => {
  await cleanupTestUser(testUser.userId)
})
```

## Safety Guarantees

1. **No accidental real user deletion** - Triple verification required
2. **No pattern-based domain deletion** - Only via org_id
3. **Automatic cleanup** - Runs daily at 3 AM
4. **Manual control** - Manager UI and CLI access
5. **Audit trail** - All cleanup logged to `/var/log/claude-bridge-cleanup.log`

## Configuration

**Systemd service**: `/etc/systemd/system/claude-bridge-cleanup.service`
**Systemd timer**: `/etc/systemd/system/claude-bridge-cleanup.timer`
**Setup script**: `/root/webalive/claude-bridge/scripts/setup-auto-cleanup.sh`

## Monitoring

```bash
# Check last cleanup
journalctl -u claude-bridge-cleanup.service -n 50

# View cleanup log
tail -100 /var/log/claude-bridge-cleanup.log

# Next scheduled run
systemctl list-timers | grep cleanup
```
