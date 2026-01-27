# PR 7: Supabase Migration

**Status**: ✅ complete (code ready, SQL migration pending deployment)
**Depends on**: PR 6 (hooks & components)
**Estimated time**: 0.5 hours

## Goal

Rename `conversation_id` column to `tab_id` in Supabase `iam.sessions` table.

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. Create migration file

- [x] Created migration SQL at `docs/prs/tab_convo_migration/migrations/001_rename_conversation_id_to_tab_id.sql`
- [x] SQL renames column, drops old constraint, adds new constraint

### 2. Update generated types

- [x] Updated `packages/database/src/iam.generated.ts`: `conversation_id` → `tab_id` in sessions Row/Insert/Update
- [x] Verify changes compile: `bun run type-check`

### 3. Update sessionStore.ts

- [x] Changed `.eq("conversation_id", tabId)` → `.eq("tab_id", tabId)` in get()
- [x] Changed `conversation_id: tabId` → `tab_id: tabId` in upsert data
- [x] Changed `onConflict: "user_id,domain_id,conversation_id"` → `onConflict: "user_id,domain_id,tab_id"`
- [x] Changed `.eq("conversation_id", tabId)` → `.eq("tab_id", tabId)` in delete()
- [x] Removed all "Note: Uses conversation_id column" comments
- [x] Verify changes compile: `bun run type-check`

### 4. Update test file

- [x] Updated mock upsert type: `conversation_id` → `tab_id`
- [x] Updated mock makeDbKey call to use `data.tab_id`

### 5. Apply to production

- [ ] Run migration SQL on production Supabase (requires manual deployment)
- [ ] Regenerate types from live DB to confirm match
- [ ] Verify deployment works

---

## Rollback Plan

If something goes wrong:

```sql
BEGIN;

ALTER TABLE iam.sessions RENAME COLUMN tab_id TO conversation_id;

ALTER TABLE iam.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_domain_id_tab_id_key;

ALTER TABLE iam.sessions ADD CONSTRAINT sessions_user_id_domain_id_conversation_id_key
  UNIQUE (user_id, domain_id, conversation_id);

COMMIT;
```

---

## Verification

- [x] Migration SQL created
- [x] Types updated and compile
- [x] sessionStore.ts uses `tab_id` column
- [x] Test updated
- [ ] Migration applied to production (manual step)

---

## Notes

**Important**: The code changes and SQL migration must be deployed together. The code now expects `tab_id` column. Deploy sequence:
1. Run SQL migration first
2. Then deploy the code

---

## Completion

- [x] Code changes complete
- [x] Update `0_overview.md`: Change PR 7 status to ✅ complete
- [ ] Production migration (manual step, separate from PR)
