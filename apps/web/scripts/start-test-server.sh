#!/usr/bin/env bash
set -euo pipefail

ENV_FILE_PATH="${ENV_FILE:-.env.e2e.local}"

if [ ! -f "$ENV_FILE_PATH" ]; then
  echo "[Test Server] Missing required env file: $ENV_FILE_PATH"
  exit 1
fi

set -a
source "$ENV_FILE_PATH"
set +a
echo "[Test Server] Loaded environment from $ENV_FILE_PATH"

if [ "${TEST_ENV:-}" != "local" ]; then
  echo "[Test Server] Invalid TEST_ENV=${TEST_ENV:-<unset>}"
  echo "[Test Server] Local E2E requires TEST_ENV=local."
  exit 1
fi

# JWT_SECRET must come from .env.e2e.local (same secret as the Supabase instance).
# Never hardcode secrets in scripts — they end up in git.
if [ -z "${JWT_SECRET:-}" ]; then
  echo "[Test Server] ERROR: JWT_SECRET not set in $ENV_FILE_PATH"
  exit 1
fi

export ALIVE_ENV=local
export PLAYWRIGHT_TEST=true
export TEST_MODE=true
export SKIP_SSL_VALIDATION=true
export SERVER_CONFIG_PATH=
export HOME=/tmp/alive-e2e-home

mkdir -p "$HOME"

echo "[Test Server] Starting local test server on port 9547"
exec bun x --bun next dev -p 9547
