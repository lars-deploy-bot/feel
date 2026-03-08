#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# SAFETY: This script DROP CASCADEs all schemas and re-applies migrations.
# It MUST NEVER run against a production or cloud database.
#
# Allowed targets:
#   - Self-hosted Supabase on private/loopback IPs (10.x, 192.168.x, 127.0.0.1)
#   - Local DATABASE_URL pointing to localhost/private IP
#
# Blocked targets:
#   - *.supabase.co (Supabase Cloud — shared by staging AND production)
#   - Any public HTTPS Supabase URL
#   - Any DATABASE_URL pointing to a cloud host
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/packages/database/migrations"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/e2e-supabase-target.sh"

REMOTE_DB_CONTAINER="supabase-db"

# ─── Production safety guard ─────────────────────────────────────────────────
# This function blocks schema resets against any non-local database.
# It checks SUPABASE_URL and DATABASE_URL independently — both must be safe.
assert_not_production_database() {
  local supabase_url="${SUPABASE_URL:-}"
  local database_url="${DATABASE_URL:-}"

  # Block any *.supabase.co URL (cloud-hosted Supabase)
  if [[ "$supabase_url" == *"supabase.co"* ]]; then
    echo "" >&2
    echo "╔══════════════════════════════════════════════════════════════╗" >&2
    echo "║  FATAL: REFUSING TO RESET A CLOUD SUPABASE DATABASE        ║" >&2
    echo "║                                                            ║" >&2
    echo "║  SUPABASE_URL points to *.supabase.co which is the         ║" >&2
    echo "║  PRODUCTION database shared by staging and production.     ║" >&2
    echo "║                                                            ║" >&2
    echo "║  This script runs DROP SCHEMA CASCADE on ALL schemas.      ║" >&2
    echo "║  Running it here would DESTROY ALL USER DATA.              ║" >&2
    echo "║                                                            ║" >&2
    echo "║  Target: $supabase_url" >&2
    echo "║                                                            ║" >&2
    echo "║  Only self-hosted Supabase on private IPs is allowed.      ║" >&2
    echo "╚══════════════════════════════════════════════════════════════╝" >&2
    echo "" >&2
    exit 1
  fi

  # Block HTTPS Supabase URLs (any cloud/public instance)
  if [[ "$supabase_url" == https://* ]]; then
    echo "" >&2
    echo "FATAL: REFUSING TO RESET — SUPABASE_URL is HTTPS (cloud/public)." >&2
    echo "  Target: $supabase_url" >&2
    echo "  Schema reset only allowed against self-hosted (HTTP, private IP)." >&2
    echo "" >&2
    exit 1
  fi

  # Block DATABASE_URL pointing to cloud hosts
  if [[ -n "$database_url" ]]; then
    if [[ "$database_url" == *"supabase.co"* ]]; then
      echo "" >&2
      echo "FATAL: REFUSING TO RESET — DATABASE_URL points to *.supabase.co." >&2
      echo "  Target: $database_url" >&2
      echo "  Schema reset only allowed against local/private databases." >&2
      echo "" >&2
      exit 1
    fi

    # Extract host from postgres:// URL and block public hosts
    local db_host
    db_host=$(echo "$database_url" | sed -n 's|.*@\([^:/]*\).*|\1|p')
    if [[ -n "$db_host" ]] && ! is_loopback_host "$db_host" && ! is_private_ipv4 "$db_host"; then
      echo "" >&2
      echo "FATAL: REFUSING TO RESET — DATABASE_URL points to public host: $db_host" >&2
      echo "  Target: $database_url" >&2
      echo "  Schema reset only allowed against localhost or private IPs." >&2
      echo "" >&2
      exit 1
    fi
  fi
}

# ─── Schema operations ───────────────────────────────────────────────────────

reset_sql_schemas() {
  cat <<'SQL'
DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS iam CASCADE;
DROP SCHEMA IF EXISTS integrations CASCADE;
DROP SCHEMA IF EXISTS lockbox CASCADE;
NOTIFY pgrst, 'reload schema';
SQL
}

reload_postgrest_sql() {
  cat <<'SQL'
NOTIFY pgrst, 'reload schema';
SQL
}

run_remote_sql() {
  local ssh_target="$1"
  ssh -o BatchMode=yes "$ssh_target" \
    "docker exec -i $REMOTE_DB_CONTAINER psql -U postgres -d postgres -v ON_ERROR_STOP=1"
}

apply_all_migrations_remote() {
  local ssh_target="$1"
  echo "[E2E DB] Resetting remote Supabase schemas on $ssh_target:$REMOTE_DB_CONTAINER"
  reset_sql_schemas | run_remote_sql "$ssh_target" >/dev/null

  while IFS= read -r migration; do
    echo "[E2E DB] Applying $(basename "$migration") on remote Supabase"
    run_remote_sql "$ssh_target" < "$migration" >/dev/null
  done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort -V)

  reload_postgrest_sql | run_remote_sql "$ssh_target" >/dev/null
}

apply_all_migrations_local() {
  local database_url="$1"
  echo "[E2E DB] Resetting local schemas via DATABASE_URL"
  reset_sql_schemas | psql "$database_url" -v ON_ERROR_STOP=1 >/dev/null

  while IFS= read -r migration; do
    echo "[E2E DB] Applying $(basename "$migration") via DATABASE_URL"
    psql "$database_url" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
  done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort -V)

  reload_postgrest_sql | psql "$database_url" -v ON_ERROR_STOP=1 >/dev/null
}

main() {
  # FIRST: block production databases before anything else
  assert_not_production_database

  resolve_supabase_source

  if is_remote_http_supabase; then
    local ssh_target="root@${E2E_SUPABASE_SOURCE_HOST}"
    apply_all_migrations_remote "$ssh_target"
    return
  fi

  if [[ -n "${DATABASE_URL:-}" ]]; then
    apply_all_migrations_local "$DATABASE_URL"
    return
  fi

  echo "[E2E DB] DATABASE_URL is not set; skipping schema reset for SUPABASE_URL=$SUPABASE_URL"
}

main "$@"
