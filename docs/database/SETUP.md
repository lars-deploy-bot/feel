# Database Setup Guide

Complete setup instructions for Claude Bridge database. This guide is designed to be followed by both humans and AI assistants (like Claude Code).

---

## Prerequisites

Before starting, ensure you have:

- [ ] **Bun** installed (`curl -fsSL https://bun.sh/install | bash`)
- [ ] **PostgreSQL 15+** OR a **Supabase** account
- [ ] Repository cloned and dependencies installed (`bun install`)

---

## Choose Your Database

### Option A: Supabase (Recommended for beginners)

Supabase provides managed PostgreSQL with a dashboard, auth, and real-time features.

### Option B: Self-Hosted PostgreSQL

Full control over your database. Requires manual PostgreSQL installation.

---

## Option A: Supabase Setup

### Step 1: Create Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose organization, set project name, generate password, select region
4. Wait for project to provision (1-2 minutes)

### Step 2: Get Credentials

Navigate to **Project Settings → Database**:

**Connection String (DATABASE_URL):**
```
postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

Navigate to **Project Settings → API**:

- `SUPABASE_URL` = Project URL (e.g., `https://abcdefg.supabase.co`)
- `SUPABASE_ANON_KEY` = anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key (keep secret!)

### Step 3: Configure Environment

Create or update `.env` in the repository root:

```bash
# Required
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Supabase client
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Encryption (generate with: openssl rand -hex 32)
LOCKBOX_MASTER_KEY="your-32-byte-hex-key"
```

### Step 4: Apply Schema

```bash
cd packages/database

# Test connection and check extensions
bun run db:setup

# Generate migrations from schema (if migrations/ is empty)
bun run db:generate

# Apply schema to database
bun run db:push
```

### Step 5: Seed Initial Data

Option 1 — **Supabase SQL Editor** (Recommended):
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `packages/database/seed/initial.sql`
3. Paste and run

Option 2 — **Command line**:
```bash
psql "$DATABASE_URL" < packages/database/seed/initial.sql
```

### Step 6: Verify

```bash
# Open visual database browser
bun run db:studio
```

Check that these schemas exist:
- `iam` — users, orgs, sessions
- `app` — domains, templates, conversations
- `integrations` — providers, policies
- `lockbox` — secrets, keys

---

## Option B: Self-Hosted PostgreSQL

### Step 1: Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Docker:**
```bash
docker run -d \
  --name claude-bridge-db \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=claude_bridge \
  -p 5432:5432 \
  postgres:15
```

### Step 2: Create Database

```bash
# Connect as postgres superuser
sudo -u postgres psql
```

```sql
-- Create database
CREATE DATABASE claude_bridge;

-- Create user (optional, can use postgres user)
CREATE USER claude_bridge WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE claude_bridge TO claude_bridge;

-- Connect to new database
\c claude_bridge

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant schema privileges to user
GRANT ALL ON SCHEMA public TO claude_bridge;

-- Exit
\q
```

### Step 3: Configure Environment

Create or update `.env`:

```bash
# PostgreSQL connection
DATABASE_URL="postgresql://claude_bridge:your_secure_password@localhost:5432/claude_bridge"

# Encryption key (generate with: openssl rand -hex 32)
LOCKBOX_MASTER_KEY="your-32-byte-hex-key"
```

### Step 4: Apply Schema

```bash
cd packages/database

# Test connection
bun run db:setup

# Generate and apply schema
bun run db:generate
bun run db:push
```

### Step 5: Seed Initial Data

```bash
psql "$DATABASE_URL" < packages/database/seed/initial.sql
```

### Step 6: Verify

```bash
bun run db:studio
```

---

## Post-Setup Configuration

### Update Server Configuration

Edit the seeded server entry to match your environment:

```sql
UPDATE app.servers
SET ip = 'YOUR_SERVER_IP',
    hostname = 'YOUR_HOSTNAME'
WHERE server_id = '00000000-0000-0000-0000-000000000001';
```

### Update Template Paths (Self-Hosted Only)

If not using the default paths, update template source paths:

```sql
UPDATE app.templates
SET source_path = '/your/path/to/templates/' || name
WHERE source_path LIKE '/srv/webalive/%';
```

---

## Quick Reference

### Scripts

```bash
cd packages/database

bun run db:setup      # Test connection, check extensions
bun run db:generate   # Generate SQL from schema changes
bun run db:push       # Apply schema to database
bun run db:studio     # Open visual browser (Drizzle Studio)
bun run db:pull       # Introspect DB → generate schema
bun run db:migrate    # Run pending migrations
```

### Schema Files

```
packages/database/src/schema/
├── index.ts          # Re-exports all schemas
├── iam.ts            # Users, orgs, sessions
├── app.ts            # Domains, conversations, automations
├── integrations.ts   # OAuth providers
└── lockbox.ts        # Encrypted secrets
```

### Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `LOCKBOX_MASTER_KEY` | ✓ | 32-byte hex encryption key |
| `SUPABASE_URL` | ○ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ○ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ | Supabase service role key |

---

## Troubleshooting

### "Connection refused" Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Fix:** PostgreSQL is not running.
```bash
# Check status
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql
```

### "Permission denied for schema" Error

```
Error: permission denied for schema iam
```

**Fix:** Grant schema permissions.
```sql
GRANT ALL ON SCHEMA iam TO your_user;
GRANT ALL ON SCHEMA app TO your_user;
GRANT ALL ON SCHEMA integrations TO your_user;
GRANT ALL ON SCHEMA lockbox TO your_user;
```

Or use Supabase service role key which has full permissions.

### "Extension not available" Error

```
Error: extension "uuid-ossp" is not available
```

**Fix:** Install PostgreSQL contrib package.
```bash
# Ubuntu/Debian
sudo apt install postgresql-contrib-15

# Then create extension
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'
```

### "Relation does not exist" Error

```
Error: relation "iam.users" does not exist
```

**Fix:** Schema not applied. Run:
```bash
cd packages/database
bun run db:push
```

### Drizzle Studio Won't Open

```bash
# Make sure you're in the right directory
cd packages/database

# Check DATABASE_URL is set
echo $DATABASE_URL

# Run studio
bun run db:studio
```

---

## Next Steps

After setup is complete:

1. **Start the application**: `bun run dev` (from repo root)
2. **Create your first user**: Sign up through the UI or insert directly
3. **Deploy a site**: Use the deployment API or UI

See also:
- [Architecture Overview](../architecture/README.md)
- [Security Guide](../security/README.md)
- [API Documentation](../api/README.md)
