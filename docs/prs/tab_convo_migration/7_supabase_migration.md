# PR 7: Supabase Migration

**Status**: ⏳ pending
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

- [ ] Create migration SQL file in appropriate location
- [ ] Add the following SQL:

```sql
-- Migration: Rename conversation_id to tab_id in iam.sessions
-- Date: YYYY-MM-DD
-- PR: tab_convo_migration

BEGIN;

-- Rename the column
ALTER TABLE iam.sessions RENAME COLUMN conversation_id TO tab_id;

-- Drop old unique constraint
ALTER TABLE iam.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_domain_id_conversation_id_key;

-- Add new unique constraint
ALTER TABLE iam.sessions ADD CONSTRAINT sessions_user_id_domain_id_tab_id_key
  UNIQUE (user_id, domain_id, tab_id);

COMMIT;
```

### 2. Test migration locally (if possible)

- [ ] Run migration against local/staging Supabase
- [ ] Verify column renamed
- [ ] Verify constraint updated
- [ ] Verify existing queries still work

### 3. Update Supabase types

- [ ] Regenerate Supabase types: `bun run supabase:types` (or equivalent)
- [ ] Update `@webalive/database` package if needed
- [ ] Verify changes compile: `bun run type-check`

### 4. Apply to production

- [ ] Schedule maintenance window if needed
- [ ] Run migration on production Supabase
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

- [ ] Migration runs without errors
- [ ] Column renamed in Supabase
- [ ] Application works with new column name
- [ ] Types regenerated and compile

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 7 status to ✅ complete
