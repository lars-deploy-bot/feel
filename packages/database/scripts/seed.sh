#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# Database Seed Runner
#
# Applies idempotent seed data (required reference rows) after migrations.
# Safe to run multiple times — all seeds use ON CONFLICT / IF NOT EXISTS.
#
# Usage:
#   bun run db:seed                          # Uses DATABASE_URL from env
#   DATABASE_URL=postgres://... bun run db:seed
#
# Seeds vs Fixtures:
#   - Seeds (this script): Reference data the app NEEDS to boot (servers, alive domain)
#   - Fixtures (E2E tests): Test data created on the fly, torn down after tests
#
# Optional env vars:
#   SEED_PASSWORD  - Password for staging bootstrap users (003_staging_users.sql)
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDS_DIR="$SCRIPT_DIR/../seeds"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  echo "  export DATABASE_URL=postgresql://postgres:password@host:port/postgres" >&2
  exit 1
fi

# Safety: block Supabase Cloud URLs
if [[ "$DATABASE_URL" == *"supabase.co"* ]]; then
  echo "ERROR: Refusing to seed a Supabase Cloud database." >&2
  echo "  Seeds should only target self-hosted instances." >&2
  echo "  Cloud databases are seeded via the Supabase dashboard or production deploy." >&2
  exit 1
fi

if [[ ! -d "$SEEDS_DIR" ]]; then
  echo "No seeds directory found at $SEEDS_DIR" >&2
  exit 1
fi

# Pass SEED_PASSWORD to psql via a SET command piped before each seed file.
# PGOPTIONS with special chars (+, =, /) gets mangled by bash — use SQL SET instead.
SEED_GUC_SQL=""
if [[ -n "${SEED_PASSWORD:-}" ]]; then
  # Escape single quotes for SQL string literal
  ESCAPED_PASSWORD="${SEED_PASSWORD//\'/\'\'}"
  SEED_GUC_SQL="SET seed.password = '${ESCAPED_PASSWORD}';"
  echo "[seed] SEED_PASSWORD is set — staging users will be seeded"
fi

seed_count=0
for seed in $(find "$SEEDS_DIR" -maxdepth 1 -type f -name '*.sql' | sort -V); do
  name=$(basename "$seed")
  echo "[seed] Applying $name"
  { echo "$SEED_GUC_SQL"; cat "$seed"; } | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 > /dev/null
  seed_count=$((seed_count + 1))
done

if [[ $seed_count -eq 0 ]]; then
  echo "[seed] No seed files found in $SEEDS_DIR"
else
  echo "[seed] Applied $seed_count seed(s) successfully"

  # Reload PostgREST schema cache so new tables/data are immediately queryable
  # via the Supabase REST API. Without this, PostgREST may serve stale schema
  # and the app fails startup checks (e.g. app.servers not found).
  echo "[seed] Reloading PostgREST schema cache..."
  psql "$DATABASE_URL" -c "NOTIFY pgrst, 'reload schema';" > /dev/null 2>&1 && \
    echo "[seed] PostgREST schema cache reloaded" || \
    echo "[seed] WARN: Could not notify PostgREST (non-fatal)"
fi
