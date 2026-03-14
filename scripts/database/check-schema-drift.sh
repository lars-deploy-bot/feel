#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/apps/web/.env.production}"

STRICT="${STRICT:-0}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/database/migrations}"
PREREQUISITES_DIR="${PREREQUISITES_DIR:-packages/database/prerequisites}"
OUTPUT_DIR="${OUTPUT_DIR:-.artifacts/schema-drift}"
SCHEMAS="${SCHEMAS:-app iam lockbox integrations}"
TARGET="${TARGET:-staging}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"

usage() {
  cat <<'EOF'
Usage:
  check-schema-drift.sh [--target staging|production] [--strict]

Environment:
  ENV_FILE             Env file used to resolve DATABASE_URL / STAGING_DATABASE_URL
  TARGET               Target database (default: staging)
  TARGET_DATABASE_URL  Optional explicit database URL override
  STRICT=1             Exit non-zero when drift is found
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || {
        echo "--target requires a value" >&2
        exit 1
      }
      TARGET="${2:-}"
      shift 2
      ;;
    --strict)
      STRICT=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$TARGET" != "staging" && "$TARGET" != "production" ]]; then
  echo "TARGET must be staging or production" >&2
  exit 1
fi

if [[ -z "$TARGET_DATABASE_URL" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi

  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a

  if [[ "$TARGET" == "production" ]]; then
    TARGET_DATABASE_URL="${DATABASE_URL:-}"
  else
    TARGET_DATABASE_URL="${STAGING_DATABASE_URL:-}"
  fi

  # pg_dump needs PGPASSWORD when the URL omits the password
  if [[ -n "${DATABASE_PASSWORD:-}" ]]; then
    export PGPASSWORD="$DATABASE_PASSWORD"
  fi
fi

if [[ -z "$TARGET_DATABASE_URL" ]]; then
  echo "Missing database URL for target=$TARGET" >&2
  exit 1
fi

LOCAL_PGHOST="${DRIFT_LOCAL_PGHOST:-localhost}"
LOCAL_PGPORT="${DRIFT_LOCAL_PGPORT:-5432}"
LOCAL_PGUSER="${DRIFT_LOCAL_PGUSER:-postgres}"
LOCAL_PGPASSWORD="${DRIFT_LOCAL_PGPASSWORD:-postgres}"
BASELINE_DB_NAME="${BASELINE_DB_NAME:-alive_drift_${GITHUB_RUN_ID:-local}_$RANDOM}"
TEMP_PG_CONTAINER_NAME=""

mkdir -p "$OUTPUT_DIR"
STATUS_FILE="$OUTPUT_DIR/status.env"
DRIFT_FILE="$OUTPUT_DIR/schema-drift.diff"
BASELINE_DUMP="$OUTPUT_DIR/baseline.schema.sql"
STAGING_DUMP="$OUTPUT_DIR/staging.schema.sql"

echo "SCHEMA_DRIFT=0" > "$STATUS_FILE"
echo "BASELINE_DB_NAME=$BASELINE_DB_NAME" >> "$STATUS_FILE"

local_pg() {
  local cmd="$1"
  shift
  PGHOST="$LOCAL_PGHOST" \
    PGPORT="$LOCAL_PGPORT" \
    PGUSER="$LOCAL_PGUSER" \
    PGPASSWORD="$LOCAL_PGPASSWORD" \
    "$cmd" "$@"
}

local_pg_ready() {
  PGPASSWORD="$LOCAL_PGPASSWORD" pg_isready \
    -h "$LOCAL_PGHOST" \
    -p "$LOCAL_PGPORT" \
    -U "$LOCAL_PGUSER" >/dev/null 2>&1
}

start_temp_postgres() {
  command -v docker >/dev/null 2>&1 || {
    echo "Docker is required to bootstrap a baseline Postgres when no local Postgres is available." >&2
    exit 1
  }

  TEMP_PG_CONTAINER_NAME="alive-drift-pg-${RANDOM}-${RANDOM}"
  echo "Starting temporary Postgres container: $TEMP_PG_CONTAINER_NAME"
  docker run -d --rm \
    --name "$TEMP_PG_CONTAINER_NAME" \
    -e POSTGRES_USER="$LOCAL_PGUSER" \
    -e POSTGRES_PASSWORD="$LOCAL_PGPASSWORD" \
    -e POSTGRES_DB=postgres \
    -P \
    postgres:16-alpine >/dev/null

  local mapped_port
  mapped_port="$(docker port "$TEMP_PG_CONTAINER_NAME" 5432/tcp | awk -F: 'NR==1 {print $2}')"
  if [[ -z "$mapped_port" ]]; then
    echo "Failed to determine mapped port for temporary Postgres container." >&2
    exit 1
  fi

  LOCAL_PGHOST="127.0.0.1"
  LOCAL_PGPORT="$mapped_port"

  for _ in $(seq 1 30); do
    if local_pg_ready; then
      echo "Temporary Postgres is ready on ${LOCAL_PGHOST}:${LOCAL_PGPORT}"
      return 0
    fi
    sleep 1
  done

  echo "Temporary Postgres did not become ready in time." >&2
  exit 1
}

cleanup() {
  local_pg dropdb --if-exists "$BASELINE_DB_NAME" >/dev/null 2>&1 || true
  if [[ -n "$TEMP_PG_CONTAINER_NAME" ]]; then
    docker rm -f "$TEMP_PG_CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

run_baseline_psql_file() {
  local file_path="$1"
  PGOPTIONS='-c search_path=public,extensions' psql "$BASELINE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file_path" >/dev/null
}

normalize_dump() {
  local input="$1"
  local output="$2"

  sed -E \
    -e '/^--/d' \
    -e '/^SET /d' \
    -e '/^SELECT pg_catalog.set_config/d' \
    -e '/^\\(un)?restrict /d' \
    -e '/^[[:space:]]*$/d' \
    "$input" | sed -E 's/[[:space:]]+$//' > "$output"

  sed -E \
    -e 's/\<extensions\.citext\>/citext/g' \
    -e 's/\<public\.citext\>/citext/g' \
    "$output" > "${output}.tmp"
  mv "${output}.tmp" "$output"
}

build_schema_args() {
  local args=()
  for schema in $SCHEMAS; do
    args+=(--schema="$schema")
  done
  printf '%s\n' "${args[@]}"
}

dump_schema() {
  local url="$1"
  local output="$2"
  local raw_output="${output}.raw"
  local schema_args=()

  while IFS= read -r arg; do
    schema_args+=("$arg")
  done < <(build_schema_args)

  pg_dump "$url" --schema-only --no-owner --no-privileges --no-comments "${schema_args[@]}" > "$raw_output"
  normalize_dump "$raw_output" "$output"
}

echo "Preparing baseline database: $BASELINE_DB_NAME"
if ! local_pg_ready; then
  echo "Local Postgres not available at ${LOCAL_PGHOST}:${LOCAL_PGPORT}; bootstrapping temporary Postgres via Docker."
  start_temp_postgres
fi

local_pg dropdb --if-exists "$BASELINE_DB_NAME" >/dev/null 2>&1 || true
local_pg createdb "$BASELINE_DB_NAME"

BASELINE_DATABASE_URL="postgresql://${LOCAL_PGUSER}:${LOCAL_PGPASSWORD}@${LOCAL_PGHOST}:${LOCAL_PGPORT}/${BASELINE_DB_NAME}"

if [[ -d "$PREREQUISITES_DIR" ]]; then
  echo "Applying prerequisites from $PREREQUISITES_DIR"
  while IFS= read -r prerequisite; do
    echo "  -> $(basename "$prerequisite")"
    run_baseline_psql_file "$prerequisite"
  done < <(find "$PREREQUISITES_DIR" -maxdepth 1 -type f -name '*.sql' | sort -V)
fi

echo "Applying migrations from $MIGRATIONS_DIR"
while IFS= read -r migration; do
  echo "  -> $(basename "$migration")"
  run_baseline_psql_file "$migration"
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort -V)

echo "Dumping baseline schema"
dump_schema "$BASELINE_DATABASE_URL" "$BASELINE_DUMP"
echo "Dumping $TARGET schema"
dump_schema "$TARGET_DATABASE_URL" "$STAGING_DUMP"

if diff -u "$BASELINE_DUMP" "$STAGING_DUMP" > "$DRIFT_FILE"; then
  echo "No schema drift detected."
  exit 0
fi

echo "Schema drift detected."
echo "SCHEMA_DRIFT=1" > "$STATUS_FILE"
echo "BASELINE_DB_NAME=$BASELINE_DB_NAME" >> "$STATUS_FILE"

echo "----- Drift preview (first 200 lines) -----"
sed -n '1,200p' "$DRIFT_FILE"

if [[ "$STRICT" == "1" ]]; then
  echo "STRICT=1 enabled, failing due to drift."
  exit 1
fi

echo "Non-strict mode: drift reported without failing."
