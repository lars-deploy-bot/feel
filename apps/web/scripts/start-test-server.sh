#!/usr/bin/env bash

# Load .env.production file if it exists (contains all secrets)
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
  echo "[Test Server] Loaded environment from .env.production"
fi

export BRIDGE_ENV=local
export PLAYWRIGHT_TEST=true
export TEST_MODE=true
export SKIP_SSL_VALIDATION=true
export SKIP_BUILD=true
exec bun x --bun next dev --turbo -p 9547
