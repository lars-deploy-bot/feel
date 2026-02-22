#!/usr/bin/env bash
set -euo pipefail

ENV_FILE_PATH="${ENV_FILE:-.env.staging}"

# E2E must always run against staging.
if [ "$ENV_FILE_PATH" != ".env.staging" ]; then
  echo "[Test Server] Invalid ENV_FILE=$ENV_FILE_PATH"
  echo "[Test Server] E2E is hard-pinned to .env.staging."
  exit 1
fi

if [ ! -f "$ENV_FILE_PATH" ]; then
  echo "[Test Server] Missing required env file: $ENV_FILE_PATH"
  exit 1
fi

set -a
source "$ENV_FILE_PATH"
set +a
echo "[Test Server] Loaded environment from $ENV_FILE_PATH"

if [ "${TEST_ENV:-}" != "staging" ]; then
  echo "[Test Server] Invalid TEST_ENV=${TEST_ENV:-<unset>}"
  echo "[Test Server] E2E is hard-pinned to staging."
  exit 1
fi

# CRITICAL: Override JWT_SECRET to match TEST_CONFIG.JWT_SECRET from @webalive/shared
# This ensures JWTs created by fixtures.ts can be verified by the server
# Single source of truth: packages/shared/src/constants.ts -> TEST_CONFIG.JWT_SECRET
# If you change this, update the constant in constants.ts.
export JWT_SECRET=test-jwt-secret-for-e2e-tests

export STREAM_ENV=local
export PLAYWRIGHT_TEST=true
export TEST_MODE=true
export SKIP_SSL_VALIDATION=true

echo "[Test Server] Starting local test server on port 9547"
exec bun x --bun next dev -p 9547
