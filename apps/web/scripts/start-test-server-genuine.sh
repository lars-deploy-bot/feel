#!/usr/bin/env bash

# Test server for GENUINE API integration tests
# Does NOT set PLAYWRIGHT_TEST=true, allowing real API calls

# Load .env file if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "[Genuine Test Server] Loaded environment from .env"
fi

export BRIDGE_ENV=local

# Important: NOT setting PLAYWRIGHT_TEST=true
# This allows the genuine E2E tests to make real API calls

echo "[Genuine Test Server] Starting on port 9548 (genuine API mode)"
echo "[Genuine Test Server] ⚠️  REAL API CALLS ENABLED - will consume credits/tokens"

exec bun x --bun next dev --turbo -p 9548
