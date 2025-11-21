#!/usr/bin/env bash

# Load .env file if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "[Test Server] Loaded environment from .env"
fi

export BRIDGE_ENV=local
export PLAYWRIGHT_TEST=true
export TEST_MODE=true
export SKIP_SSL_VALIDATION=true
export SKIP_BUILD=true
exec bun x --bun next dev --turbo -p 9547
