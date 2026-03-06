#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ENV_FILE="${ENV_FILE:-.env.e2e.local}"
RUNTIME_ENV_FILE="${RUNTIME_ENV_FILE:-/tmp/alive-e2e-runtime-${USER:-root}-$RANDOM.env}"
LOCAL_SUPABASE_PORT="${LOCAL_SUPABASE_PORT:-18000}"
SSH_TUNNEL_PID=""

# shellcheck source=/dev/null
source "$SCRIPT_DIR/e2e-supabase-target.sh"

cleanup() {
  if [[ -n "$SSH_TUNNEL_PID" ]]; then
    kill "$SSH_TUNNEL_PID" >/dev/null 2>&1 || true
    wait "$SSH_TUNNEL_PID" >/dev/null 2>&1 || true
  fi

  rm -f "$RUNTIME_ENV_FILE"
}
trap cleanup EXIT

if [[ $# -eq 0 ]]; then
  echo "Usage: bash scripts/run-local-e2e.sh <command> [args...]" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_ENV_FILE" ]]; then
  echo "[E2E] Missing env file: $SOURCE_ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$SOURCE_ENV_FILE"
set +a

if [[ "${TEST_ENV:-}" != "local" ]]; then
  echo "[E2E] Local wrapper requires TEST_ENV=local in $SOURCE_ENV_FILE" >&2
  exit 1
fi

resolve_supabase_source

bash "$SCRIPT_DIR/reset-e2e-supabase.sh"

cp "$SOURCE_ENV_FILE" "$RUNTIME_ENV_FILE"
chmod 600 "$RUNTIME_ENV_FILE"

upsert_env_var() {
  local key="$1"
  local value="$2"

  sed -i "/^${key}=/d" "$RUNTIME_ENV_FILE"
  printf '%s=%s\n' "$key" "$value" >> "$RUNTIME_ENV_FILE"
}

delete_env_var() {
  local key="$1"
  sed -i "/^${key}=/d" "$RUNTIME_ENV_FILE"
}

wait_for_tcp_port() {
  local host="$1"
  local port="$2"
  local label="$3"
  local attempt

  for attempt in $(seq 1 50); do
    if (echo >"/dev/tcp/$host/$port") >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  echo "[E2E] Timed out waiting for $label at $host:$port" >&2
  return 1
}

if is_remote_http_supabase; then
  local_target="http://127.0.0.1:${LOCAL_SUPABASE_PORT}"
  ssh_target="root@${E2E_SUPABASE_SOURCE_HOST}"

  echo "[E2E] Tunneling remote Supabase API $SUPABASE_URL via $ssh_target -> $local_target"
  ssh \
    -o BatchMode=yes \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -N \
    -L "127.0.0.1:${LOCAL_SUPABASE_PORT}:127.0.0.1:${E2E_SUPABASE_SOURCE_PORT}" \
    "$ssh_target" &
  SSH_TUNNEL_PID="$!"

  wait_for_tcp_port "127.0.0.1" "$LOCAL_SUPABASE_PORT" "tunneled Supabase API"

  export SUPABASE_URL="$local_target"
  export NEXT_PUBLIC_SUPABASE_URL="$local_target"

  upsert_env_var "SUPABASE_URL" "$SUPABASE_URL"
  upsert_env_var "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"

  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "[E2E] DATABASE_URL points at remote-only Postgres and will not be exposed to the local app runtime."
    unset DATABASE_URL
    delete_env_var "DATABASE_URL"
  fi
fi

echo "[E2E] Runtime env file: $RUNTIME_ENV_FILE"
echo "[E2E] App target: ${NEXT_PUBLIC_APP_URL:-<unset>}"
echo "[E2E] Supabase target: $SUPABASE_URL"

ENV_FILE="$RUNTIME_ENV_FILE" "$@"
