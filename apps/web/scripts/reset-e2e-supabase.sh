#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/packages/database/migrations"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/e2e-supabase-target.sh"

REMOTE_DB_CONTAINER="supabase-db"

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
