# Migration Files Created - Summary

**Status:** Database infrastructure complete
**Next:** Update authentication code
**Last Updated:** 2025-11-14

---

## Files Created

### 1. Database Infrastructure (✅ Complete)

#### Core Database Files
- ✅ `/drizzle.config.ts` - Drizzle ORM configuration
- ✅ `/apps/web/lib/db/schema.ts` - Database schema (users, workspaces, user_workspaces, sessions)
- ✅ `/apps/web/lib/db/client.ts` - Database client with WAL mode & health checks

#### Database Repositories (Clean Abstraction Layer)
- ✅ `/apps/web/lib/db/repositories/users.ts` - User operations
- ✅ `/apps/web/lib/db/repositories/workspaces.ts` - Workspace operations
- ✅ `/apps/web/lib/db/repositories/user-workspaces.ts` - Authorization operations
- ✅ `/apps/web/lib/db/repositories/sessions.ts` - Session persistence operations
- ✅ `/apps/web/lib/db/repositories/index.ts` - Repository exports

### 2. Migration Scripts (✅ Complete)

- ✅ `/scripts/init-database.ts` - Initialize database tables and indexes
- ✅ `/scripts/migrate-to-database.ts` - Robust migration with dry-run, transactions, validation
- ✅ `/scripts/verify-migration.ts` - Post-migration integrity checks
- ✅ `/scripts/test-login.ts` - Test user login after migration
- ✅ `/scripts/backup-current-state.sh` - Backup script (executable)

### 3. Documentation (✅ Complete)

- ✅ `/docs/currently-working-on-this/users-workspaces-migration-plan.md` - Original detailed plan
- ✅ `/docs/currently-working-on-this/MIGRATION-EXECUTION-PLAN.md` - Step-by-step execution guide
- ✅ `/docs/currently-working-on-this/MIGRATION-FILES-CREATED.md` - This file

---

## What's Ready to Use

### Database Schema

**Tables Created:**
1. **users** - User accounts with email/password
2. **workspaces** - Workspace definitions with domain/port/credits
3. **user_workspaces** - Junction table for authorization
4. **sessions** - Claude SDK session persistence

**Indexes Created:**
- Unique constraints on emails and domains
- Foreign key indexes for fast lookups
- Expiration indexes for session cleanup

**Features:**
- WAL mode for concurrency
- Foreign key constraints enabled
- Automatic timestamp tracking
- Cascade deletes

### Migration Features

**Dry-Run Mode:**
```bash
bun scripts/migrate-to-database.ts --dry-run
```

**Validation:**
- Required field checks
- Email format validation
- Duplicate detection
- Conflict resolution (email +suffix strategy)
- Password hash reuse (existing bcrypt hashes)

**Transaction Support:**
- All-or-nothing migration
- Automatic rollback on error
- Detailed logging at each step

**Post-Migration Verification:**
```bash
bun scripts/verify-migration.ts
```

Checks:
- Database health
- Table counts
- Orphaned records
- Unique constraints
- Required fields
- Sample data relationships

---

## Files That Need to Be Modified

### Authentication Files (⏳ Pending)

These files need updates to use the database instead of JSON:

1. **`apps/web/features/auth/lib/jwt.ts`**
   - Change payload from `{ workspaces: string[] }` to `{ userId: string }`
   - Remove `addWorkspaceToToken()` function
   - Keep `verifySessionToken()` and `createSessionToken()`

2. **`apps/web/features/auth/lib/auth.ts`**
   - Update `getSessionUser()` - use `userRepository.findById()`
   - Update `isWorkspaceAuthenticated()` - use `userWorkspaceRepository.hasAccessByDomain()`
   - Update `getAuthenticatedWorkspaces()` - use `userWorkspaceRepository.getWorkspacesForUser()`
   - Add `userRepository.updateLastLogin()` call

3. **`apps/web/features/auth/lib/sessionStore.ts`**
   - Replace `SessionStoreMemory` with `sessionRepository`
   - Update interface to match repository methods

4. **`apps/web/app/api/login/route.ts`**
   - Remove workspace + passcode login
   - Add email + password login
   - Use `userRepository.findByEmail()`
   - Use `verifyPassword()` from existing code
   - Create JWT with userId instead of workspaces
   - Update last login timestamp

5. **`apps/web/app/api/claude/stream/route.ts`**
   - Get user from JWT → `getSessionUser()`
   - Resolve workspace domain → `workspaceRepository.findByDomain()`
   - Check authorization → `userWorkspaceRepository.hasAccess()`
   - Update session store calls → `sessionRepository.get/set()`

### New Files Needed (⏳ Pending)

6. **`apps/web/app/api/auth/register/route.ts`** (NEW)
   - User registration endpoint
   - Email validation
   - Password hashing
   - Create JWT and session cookie

7. **`apps/web/app/workspaces/page.tsx`** (NEW)
   - Workspace selection page
   - List user's workspaces
   - Allow selecting workspace for chat

8. **`apps/web/features/auth/components/LoginForm.tsx`** (MODIFY)
   - Update UI from workspace+passcode to email+password
   - Remove workspace field
   - Rename passcode to password

---

## Execution Checklist

### Pre-Migration (Before Running Scripts)

- [ ] Install dependencies: `cd apps/web && bun add drizzle-orm better-sqlite3 && bun add -d drizzle-kit @types/better-sqlite3`
- [ ] Review migration plan: `/docs/currently-working-on-this/MIGRATION-EXECUTION-PLAN.md`
- [ ] Backup current state: `./scripts/backup-current-state.sh`
- [ ] Verify backup exists: `ls -la /var/lib/claude-bridge/backups/`

### Migration Execution

- [ ] Initialize database: `bun scripts/init-database.ts`
- [ ] Test migration (dry-run): `bun scripts/migrate-to-database.ts --dry-run`
- [ ] Review dry-run output (check user emails, workspace counts)
- [ ] Run migration: `bun scripts/migrate-to-database.ts`
- [ ] Verify migration: `bun scripts/verify-migration.ts`
- [ ] Test login: `bun scripts/test-login.ts demo-goalive-nl@bridge.local supersecret`

### Code Updates (After Migration)

- [ ] Update JWT payload structure (`features/auth/lib/jwt.ts`)
- [ ] Update auth helpers to use database (`features/auth/lib/auth.ts`)
- [ ] Update login endpoint (`app/api/login/route.ts`)
- [ ] Update session store (`features/auth/lib/sessionStore.ts`)
- [ ] Update Claude stream route (`app/api/claude/stream/route.ts`)
- [ ] Create registration endpoint (`app/api/auth/register/route.ts`)
- [ ] Create workspace selection page (`app/workspaces/page.tsx`)
- [ ] Update login form UI (`features/auth/components/LoginForm.tsx`)

### Testing

- [ ] Test user login with email/password
- [ ] Test workspace authorization
- [ ] Test conversation persistence
- [ ] Test multiple workspaces per user
- [ ] Test session expiration
- [ ] Check PM2 logs for errors

### Deployment

- [ ] Build application: `cd apps/web && bun run build`
- [ ] Restart service: `pm2 restart claude-bridge`
- [ ] Verify health check: `curl http://localhost:8999/api/health`
- [ ] Monitor logs: `pm2 logs claude-bridge`

---

## Rollback Plan

If something goes wrong:

```bash
# 1. Find latest backup
BACKUP=$(ls -td /var/lib/claude-bridge/backups/* | head -1)
echo "Rolling back to: $BACKUP"

# 2. Stop service
pm2 stop claude-bridge

# 3. Restore JSON file
cp "$BACKUP/domain-passwords.json" /var/lib/claude-bridge/domain-passwords.json

# 4. Delete database
rm -f /var/lib/claude-bridge/database.sqlite*

# 5. Revert code
cd /root/webalive/claude-bridge
git checkout apps/web/features/auth/
git checkout apps/web/app/api/

# 6. Rebuild
cd apps/web && bun run build

# 7. Restart
pm2 restart claude-bridge

echo "✅ Rollback complete"
```

---

## Environment Variables

Add to production `.env` or PM2 ecosystem config:

```bash
# Required
DATABASE_PATH=/var/lib/claude-bridge/database.sqlite

# Optional (defaults shown)
DATABASE_WAL_MODE=true
DATABASE_BUSY_TIMEOUT=5000
```

---

## Next Steps

1. **Install dependencies** (if not done yet)
2. **Run migration scripts** (init → migrate → verify)
3. **Update authentication code** (see "Files That Need to Be Modified" section)
4. **Test locally** before deploying
5. **Deploy to production** (no gradual rollout - hard cutover)

---

## Contact Info for Each Migration Phase

### Phase 1: Database Setup (✅ Done)
All files created and ready to use.

### Phase 2: Data Migration (⏳ Ready to Run)
Scripts are ready. Run when ready:
```bash
bun scripts/init-database.ts
bun scripts/migrate-to-database.ts --dry-run  # Review first!
bun scripts/migrate-to-database.ts
bun scripts/verify-migration.ts
```

### Phase 3: Code Updates (⏳ Pending)
See "Files That Need to Be Modified" section above.
Requires manual code changes to 8 files.

### Phase 4: Deployment (⏳ Pending)
After code updates, build and restart service.

---

## Notes

- **No backward compatibility needed** - Hard cutover approach
- **All users will be logged out** - Must re-login with email/password
- **Passwords preserved** - Existing bcrypt hashes reused, users can login with same password
- **Email generation** - Auto-generated as `{domain-with-dashes}@bridge.local` if not present
- **Session persistence** - Database-backed, survives server restarts
- **Transaction support** - Migration is atomic (all-or-nothing)

---

## Success Criteria

Migration is successful when:
- ✅ Database initialized with 4 tables
- ✅ All workspaces migrated (verify count matches JSON)
- ✅ All users created with valid emails
- ✅ All user-workspace links created
- ✅ Users can log in with email + old password
- ✅ Users can access their workspaces
- ✅ Conversations persist across page refresh
- ✅ No errors in PM2 logs
- ✅ Health check passes

---

**Status:** Ready for Phase 2 (Data Migration)
**Estimated Time to Complete All Phases:** 4-6 hours
