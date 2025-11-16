# Users & Workspaces Migration - Execution Plan

**Status:** Ready to Execute
**Approach:** Hard Cutover (No Backward Compatibility)
**Estimated Downtime:** 5-10 minutes

---

## Phase 0: Pre-Migration (Do This First)

### 1. Backup Current State

```bash
# Create backup directory
mkdir -p /var/lib/claude-bridge/backups/$(date +%Y%m%d-%H%M%S)

# Backup domain passwords
cp /var/lib/claude-bridge/domain-passwords.json \
   /var/lib/claude-bridge/backups/$(date +%Y%m%d-%H%M%S)/domain-passwords.json

# Verify backup
cat /var/lib/claude-bridge/backups/$(date +%Y%m%d-%H%M%S)/domain-passwords.json | jq 'keys | length'
```

### 2. Install Dependencies

```bash
cd /root/webalive/claude-bridge/apps/web
bun add drizzle-orm better-sqlite3
bun add -d drizzle-kit @types/better-sqlite3
```

---

## Phase 1: Database Setup

### File 1: Drizzle Config

**Location:** `/root/webalive/claude-bridge/drizzle.config.ts`

### File 2: Database Schema

**Location:** `/root/webalive/claude-bridge/apps/web/lib/db/schema.ts`

### File 3: Database Client

**Location:** `/root/webalive/claude-bridge/apps/web/lib/db/client.ts`

### File 4: Database Initialization Script

**Location:** `/root/webalive/claude-bridge/scripts/init-database.ts`

Run this to create the database:

```bash
bun scripts/init-database.ts
```

Expected output:
```
✓ Database file created: /var/lib/claude-bridge/database.sqlite
✓ Tables created: users, workspaces, user_workspaces, sessions
✓ Indexes created
Database ready for migration
```

---

## Phase 2: Data Migration

### File 5: Migration Script (Robust Version)

**Location:** `/root/webalive/claude-bridge/scripts/migrate-to-database.ts`

Features:
- **Dry run mode** - test before applying
- **Transaction support** - all-or-nothing
- **Validation** - verify every step
- **Duplicate detection** - handle edge cases
- **Detailed logging** - know exactly what happened
- **Rollback on error** - automatic cleanup

Run dry-run first:
```bash
bun scripts/migrate-to-database.ts --dry-run
```

Expected output:
```
[DRY RUN] Would migrate 47 workspaces
[DRY RUN] Would create 47 users
[DRY RUN] Would create 47 user-workspace links
[DRY RUN] No conflicts detected
✓ Dry run completed successfully
```

Then run for real:
```bash
bun scripts/migrate-to-database.ts
```

Expected output:
```
✓ Migrated demo.goalive.nl → user demo-goalive-nl@bridge.local
✓ Migrated crazywebsite.nl → user crazywebsite-nl@bridge.local
...
✓ 47 workspaces migrated
✓ 47 users created
✓ 47 workspace links created
Migration complete!
```

Verify migration:
```bash
bun scripts/verify-migration.ts
```

---

## Phase 3: Code Changes

### 1. Update JWT (No Backward Compatibility)

**File:** `apps/web/features/auth/lib/jwt.ts`

**Changes:**
- Remove `workspaces: string[]` from payload
- Add `userId: string` to payload
- Remove `addWorkspaceToToken()` function (no longer needed)

### 2. Update Auth Helpers

**File:** `apps/web/features/auth/lib/auth.ts`

**Changes:**
- `getSessionUser()` → Query database by userId
- `isWorkspaceAuthenticated()` → Query user_workspaces table
- `getAuthenticatedWorkspaces()` → Query user_workspaces with join
- Remove all legacy token handling

### 3. Replace Login Endpoint

**File:** `apps/web/app/api/login/route.ts`

**Changes:**
- Remove workspace + passcode login
- Add email + password login
- Query users table instead of JSON file
- Return user workspaces in response

### 4. Add Registration Endpoint

**File:** `apps/web/app/api/auth/register/route.ts` (NEW)

### 5. Replace Session Store

**File:** `apps/web/features/auth/lib/sessionStore.ts`

**Changes:**
- Remove in-memory Map
- Add database-backed storage using sessions table
- Add automatic cleanup of expired sessions

### 6. Update Claude Stream Route

**File:** `apps/web/app/api/claude/stream/route.ts`

**Changes:**
- Get user from JWT → userId
- Resolve workspace domain → workspaceId
- Update session key format: use IDs instead of strings
- Query user_workspaces for authorization

### 7. Add Workspace Selection Page

**File:** `apps/web/app/workspaces/page.tsx` (NEW)

### 8. Update Login UI

**File:** `apps/web/features/auth/components/LoginForm.tsx`

**Changes:**
- Remove workspace input field
- Remove passcode input field
- Add email input field
- Keep password field (rename from passcode)

---

## Phase 4: Deployment

### Single Deployment Script

**Location:** `/root/webalive/claude-bridge/scripts/migrate-and-deploy.sh`

This script does everything in order:

```bash
#!/bin/bash
set -e

echo "🚀 Starting migration and deployment..."

# 1. Stop the service
pm2 stop claude-bridge

# 2. Backup current state
./scripts/backup-current-state.sh

# 3. Initialize database
bun scripts/init-database.ts

# 4. Migrate data
bun scripts/migrate-to-database.ts

# 5. Verify migration
bun scripts/verify-migration.ts

# 6. Build new code
cd apps/web && bun run build

# 7. Restart service
pm2 restart claude-bridge

# 8. Verify deployment
sleep 5
curl -f http://localhost:8999/api/health || (echo "❌ Health check failed" && exit 1)

echo "✅ Migration and deployment complete!"
```

Run it:
```bash
cd /root/webalive/claude-bridge
./scripts/migrate-and-deploy.sh
```

---

## Phase 5: Verification

### Post-Migration Checks

```bash
# 1. Check database
sqlite3 /var/lib/claude-bridge/database.sqlite "
  SELECT
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM workspaces) as workspaces,
    (SELECT COUNT(*) FROM user_workspaces) as links;
"

# Expected: users=47, workspaces=47, links=47

# 2. Check specific workspace
sqlite3 /var/lib/claude-bridge/database.sqlite "
  SELECT u.email, w.domain, uw.role
  FROM users u
  JOIN user_workspaces uw ON u.id = uw.user_id
  JOIN workspaces w ON uw.workspace_id = w.id
  WHERE w.domain = 'demo.goalive.nl';
"

# Expected: demo-goalive-nl@bridge.local | demo.goalive.nl | owner

# 3. Test login
curl -X POST http://localhost:8999/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo-goalive-nl@bridge.local","password":"supersecret"}'

# Expected: {"ok":true,"userId":"..."}

# 4. Test workspace access
curl -X POST http://localhost:8999/api/verify \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"workspace":"demo.goalive.nl"}'

# Expected: {"exists":true}
```

---

## Rollback Plan

If anything goes wrong:

```bash
#!/bin/bash
# scripts/rollback-migration.sh

echo "🔄 Rolling back migration..."

# 1. Stop service
pm2 stop claude-bridge

# 2. Restore JSON file
LATEST_BACKUP=$(ls -t /var/lib/claude-bridge/backups/*/domain-passwords.json | head -1)
cp "$LATEST_BACKUP" /var/lib/claude-bridge/domain-passwords.json

# 3. Delete database
rm -f /var/lib/claude-bridge/database.sqlite

# 4. Git revert
cd /root/webalive/claude-bridge
git checkout apps/web/features/auth/
git checkout apps/web/app/api/

# 5. Rebuild
cd apps/web && bun run build

# 6. Restart
pm2 restart claude-bridge

echo "✅ Rollback complete"
```

---

## Migration Data Strategy

### User Creation Strategy

For each workspace in `domain-passwords.json`:

**Email Generation:**
1. If `config.email` exists and is valid → use it
2. Else → generate: `{domain-with-dashes}@bridge.local`

**Example:**
```
demo.goalive.nl → demo-goalive-nl@bridge.local
crazywebsite.nl → crazywebsite-nl@bridge.local
```

**Conflict Handling:**
If multiple workspaces have same email:
```
workspace1.com → user1@example.com
workspace2.com → user1@example.com  (conflict!)
```

Resolution:
```
workspace1.com → user1@example.com
workspace2.com → user1+workspace2@example.com  (add +workspace suffix)
```

**Password:**
- Reuse existing `passwordHash` (already bcrypt)
- Users can log in with same password they used before

**User Metadata:**
- `name`: Domain name initially (users can update later)
- `createdAt`: Use workspace `createdAt` if available
- `lastLoginAt`: NULL initially

### Workspace Migration

Map directly:
- `tenantId` → `id` (preserve existing UUIDs)
- `domain` → `domain`
- `port` → `port`
- `credits` → `credits`
- `createdAt` → `createdAt`

### User-Workspace Links

For each migrated user:
- Create link to their workspace
- Set `role` = 'owner' (they owned the workspace password)

---

## Environment Variables

Add to production environment:

```bash
# /root/webalive/claude-bridge/.env.local (or PM2 ecosystem)
DATABASE_PATH=/var/lib/claude-bridge/database.sqlite
```

Optional (defaults work):
```bash
DATABASE_WAL_MODE=true  # Better concurrency (default: true)
DATABASE_BUSY_TIMEOUT=5000  # Lock timeout in ms (default: 5000)
```

---

## Testing Before Migration

### Local Test (Recommended)

```bash
# 1. Copy production data to local
scp root@server:/var/lib/claude-bridge/domain-passwords.json ./test-data.json

# 2. Run migration locally
DATABASE_PATH=./test.sqlite \
DOMAIN_PASSWORDS_PATH=./test-data.json \
bun scripts/migrate-to-database.ts --dry-run

# 3. Verify
sqlite3 test.sqlite "SELECT * FROM users LIMIT 5;"

# 4. Test with actual code
DATABASE_PATH=./test.sqlite bun run dev

# 5. Try logging in at http://localhost:8999
```

---

## Post-Migration Tasks

### 1. Update Documentation

- [ ] Update README.md authentication section
- [ ] Update CLAUDE.md with new auth flow
- [ ] Update security docs with database schema

### 2. Add Missing Features

- [ ] Password reset endpoint
- [ ] Email verification (if using real emails)
- [ ] User profile management
- [ ] Workspace invitation system

### 3. Monitoring

- [ ] Add database health check
- [ ] Monitor database file size growth
- [ ] Set up automatic session cleanup (cron job)

### 4. Security Hardening

- [ ] Set database file permissions: `chmod 600 /var/lib/claude-bridge/database.sqlite`
- [ ] Review JWT secret strength
- [ ] Add rate limiting to login endpoint
- [ ] Add failed login attempt tracking

---

## Timeline

**Preparation:** 4 hours
- Write database schema
- Write migration script
- Write verification script
- Test locally

**Execution:** 10 minutes
- Stop service
- Backup data
- Run migration
- Verify
- Restart service

**Verification:** 30 minutes
- Test all login flows
- Test workspace access
- Test conversation persistence
- Check database integrity

**Total:** ~5 hours (including preparation)

---

## Success Criteria

- [ ] Database created with all tables
- [ ] All 47 workspaces migrated (verify count)
- [ ] All users created with correct emails
- [ ] All user-workspace links created
- [ ] Users can log in with email + old password
- [ ] Users can access their workspaces
- [ ] Conversations persist across page refresh
- [ ] No errors in PM2 logs
- [ ] Health check passes
- [ ] Rollback tested (can revert if needed)
