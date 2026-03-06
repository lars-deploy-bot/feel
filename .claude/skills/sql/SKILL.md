---
name: sql
description: Execute SQL against staging or production databases using the repo helper. Production writes require explicit confirmation.
---

# /sql

Use the helper script:

`scripts/database/sql.sh`

It loads DB URLs from `apps/web/.env.production` (or `ENV_FILE`) and supports:
- `--target staging` (uses `STAGING_DATABASE_URL`)
- `--target production` (uses `DATABASE_URL`)

## CRITICAL WARNINGS

**Production is live data. There is no undo.**

Before running ANY SQL:
1. **Read-only first** - Always SELECT before UPDATE/DELETE
2. **Use transactions** - Wrap destructive operations in BEGIN/ROLLBACK first
3. **Backup affected data** - SELECT into a backup table before modifying
4. **Limit scope** - Always use WHERE clauses, never update entire tables
5. **Double-check** - Read the query twice before executing

## Bash Tool Gotchas

**The Bash tool escapes `!` to `\!`**, which silently breaks:
- `!=` → `\!=` (SQL not-equal) — **use `<>` instead**
- `NOT IN (...)` is unaffected and always works

```sql
-- BAD (will error from Bash tool):
SELECT * FROM iam.users WHERE status != 'active';

-- GOOD:
SELECT * FROM iam.users WHERE status <> 'active';
```

For complex queries with special characters, use `--stdin` mode or `--file`:
```bash
cat << 'EOF' | scripts/database/sql.sh --target staging --stdin
SELECT * FROM iam.users WHERE status != 'active';
EOF
```

## Connection Details

**Location:** `apps/web/.env.production`

```bash
DATABASE_URL=$DATABASE_URL
STAGING_DATABASE_URL=$STAGING_DATABASE_URL
```

## How to Run SQL

### Single Query
```bash
scripts/database/sql.sh --target staging --query "SELECT now();"
```

### Multi-line / Complex Queries
```bash
cat << 'EOF' | scripts/database/sql.sh --target staging --stdin --tx
-- Your SQL here
SELECT * FROM iam.users LIMIT 5;
EOF
```

### From SQL File
```bash
scripts/database/sql.sh --target staging --file /tmp/check.sql
```

### Interactive Session
```bash
scripts/database/sql.sh --target staging --interactive
```

### Custom DB URL (bypass env lookup)
```bash
scripts/database/sql.sh --target production --url "postgresql://..." --query "SELECT 1;"
```

### Production Write (explicit confirm required)
```bash
scripts/database/sql.sh \
  --target production \
  --query "UPDATE iam.orgs SET credits = credits + 10 WHERE org_id = 'org_x'" \
  --confirm-production-write \
  --tx
```

## Database Schemas

| Schema | Purpose | Key Tables |
|--------|---------|------------|
| `iam` | Identity & Access | `users`, `orgs`, `org_memberships`, `sessions`, `auth_sessions`, `email_invites`, `org_invites`, `referrals`, `user_preferences` |
| `app` | Application data | `domains`, `automation_jobs`, `automation_runs`, `conversations`, `messages`, `conversation_tabs`, `templates`, `feedback`, `servers`, `user_quotas`, `user_profile`, `user_onboarding`, `errors`, `gateway_settings` |
| `integrations` | OAuth | `providers`, `oauth_external_identities`, `oauth_states`, `access_policies` |
| `lockbox` | Encrypted secrets | `secret_keys`, `user_secrets` |
| `mcp` | MCP marketplace | `servers`, `server_versions`, `server_transports`, `server_transport_secrets`, `server_instances`, `tools`, `prompts`, `resources`, `tags`, `server_tags`, `user_server_configs`, `org_access`, `beta_access`, `approvals`, `review_events`, `health_checks` |

## Key Column Names (IMPORTANT — avoid wrong column names)

These columns are frequently confused. Always use the correct names:

| Table | PK | Name/Label Column | FK to domains | FK to orgs |
|-------|----|--------------------|---------------|------------|
| `app.domains` | `domain_id` | **`hostname`** (NOT `domain`) | — | `org_id` |
| `app.automation_jobs` | `id` | `name` | **`site_id`** (NOT `domain_id`) → `domains.domain_id` | `org_id` |
| `app.automation_runs` | `id` | — | — (join via `job_id` → `automation_jobs.id`) | — |
| `app.conversations` | `conversation_id` | `title`, `workspace` | — (uses `workspace` text, not FK) | `org_id` |
| `iam.sessions` | `session_id` | `sdk_session_id`, `tab_id` | **`domain_id`** → `domains.domain_id` | — (join via `user_id`) |
| `iam.users` | `user_id` | `email`, `display_name` | — | — (join via `org_memberships`) |
| `iam.orgs` | `org_id` | `name` | — | — |
| `iam.org_memberships` | (`org_id`, `user_id`) composite | `role` (owner/admin/member) | — | `org_id` |
| `app.servers` | `server_id` | `name`, `hostname`, `ip` | — | — |

## Enum Values (for WHERE clauses)

**`automation_jobs` has TWO status columns — don't confuse them:**

| Column | Enum Type | Valid Values | Meaning |
|--------|-----------|--------------|---------|
| `status` | `app.automation_job_status` | `idle`, `running`, `paused`, `disabled` | Job lifecycle state |
| `last_run_status` | `app.automation_run_status` | `pending`, `running`, `success`, `failure`, `skipped` | Outcome of last run |

Other enums:

| Enum Type | Valid Values |
|-----------|--------------|
| `app.automation_trigger_type` | `cron`, `webhook`, `one-time`, `email` |
| `app.automation_action_type` | `prompt`, `sync`, `publish` |
| `app.execution_mode` | `systemd`, `e2b` |

## Common Joins

### Automation jobs with domain hostname
```sql
SELECT j.id, j.name, j.trigger_type, j.is_active, j.next_run_at, d.hostname
FROM app.automation_jobs j
JOIN app.domains d ON j.site_id = d.domain_id
ORDER BY j.next_run_at;
```

### Automation runs with job name
```sql
SELECT r.id, r.status, r.started_at, r.duration_ms, j.name AS job_name
FROM app.automation_runs r
JOIN app.automation_jobs j ON r.job_id = j.id
ORDER BY r.started_at DESC LIMIT 20;
```

### Domains with org name
```sql
SELECT d.hostname, d.port, d.execution_mode, o.name AS org_name
FROM app.domains d
JOIN iam.orgs o ON d.org_id = o.org_id;
```

### Full automation debugging (runs + jobs + domains, 3-way join)
```sql
SELECT r.id, r.status, r.started_at, r.duration_ms, r.error,
       j.name AS job_name, d.hostname
FROM app.automation_runs r
JOIN app.automation_jobs j ON r.job_id = j.id
JOIN app.domains d ON j.site_id = d.domain_id
WHERE r.status = 'failure'
ORDER BY r.started_at DESC LIMIT 10;
```

### User's domains (user → org_memberships → orgs → domains)
```sql
SELECT u.email, o.name AS org_name, d.hostname, d.port
FROM iam.users u
JOIN iam.org_memberships m ON u.user_id = m.user_id
JOIN iam.orgs o ON m.org_id = o.org_id
JOIN app.domains d ON d.org_id = o.org_id
WHERE u.email = 'user@example.com';
```

### Active sessions with domain hostname
```sql
SELECT s.session_id, s.user_id, s.tab_id, d.hostname, s.last_activity
FROM iam.sessions s
JOIN app.domains d ON s.domain_id = d.domain_id
WHERE s.expires_at > now()
ORDER BY s.last_activity DESC LIMIT 10;
```

## Common Safe Operations

### List tables in a schema
```bash
scripts/database/sql.sh --target staging --query "\dt iam.*"
```

### Describe a table
```bash
scripts/database/sql.sh --target staging --query "\d iam.users"
```

### Count rows
```bash
scripts/database/sql.sh --target staging --query "SELECT COUNT(*) FROM iam.users;"
```

## Safe Migration Pattern

For schema changes (CREATE TABLE, ALTER TABLE, etc.):

```bash
cat << 'EOF' | scripts/database/sql.sh --target staging --stdin --tx
-- Step 1: Create table
CREATE TABLE IF NOT EXISTS app.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_new_table_col ON app.new_table(column_name);

-- Step 3: Grant permissions
GRANT ALL ON app.new_table TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.new_table TO authenticated;

-- Step 4: Verify
\d app.new_table
EOF
```

## Dangerous Operations Checklist

Before running UPDATE, DELETE, or DROP:

- [ ] I have run a SELECT with the same WHERE clause first
- [ ] I have counted the affected rows
- [ ] I have backed up the affected data if needed
- [ ] I have tested this in a transaction with ROLLBACK
- [ ] I understand this cannot be undone
- [ ] The user explicitly requested this change

### Safe DELETE Pattern
```sql
-- Step 1: Count what will be deleted
SELECT COUNT(*) FROM table WHERE condition;

-- Step 2: Review sample
SELECT * FROM table WHERE condition LIMIT 10;

-- Step 3: Test in transaction
BEGIN;
DELETE FROM table WHERE condition;
-- Check results
ROLLBACK;  -- Or COMMIT if correct

-- Step 4: Execute for real
DELETE FROM table WHERE condition;
```

## After Schema Changes

After creating or modifying tables, regenerate TypeScript types:

```bash
cd packages/database && bun run gen:types
```

This updates the generated types in `packages/database/src/*.generated.ts`.

## Forbidden Operations

**NEVER run these without explicit user confirmation:**

- `DROP TABLE` / `DROP SCHEMA`
- `TRUNCATE`
- `DELETE` without WHERE clause
- `UPDATE` without WHERE clause
- `ALTER TABLE ... DROP COLUMN`
- Any operation on `iam.users`, `iam.orgs` that affects many rows

## Quick Reference

```bash
# Staging read
scripts/database/sql.sh --target staging --query "SELECT 1;"

# Production read
scripts/database/sql.sh --target production --query "SELECT 1;"

# Production write (requires explicit confirmation flag)
scripts/database/sql.sh --target production --query "UPDATE ... WHERE ..." --confirm-production-write
```

## Environment Note

If `STAGING_DATABASE_URL` is not present in `apps/web/.env.production`, staging target will fail by design until it is configured.
