#!/usr/bin/env bash
set -euo pipefail

# Test server for GENUINE API integration tests
# Does NOT set PLAYWRIGHT_TEST=true, allowing real API calls

ENV_FILE_PATH="${ENV_FILE:-.env.staging}"

# Load selected env file (staging by default).
if [ -f "$ENV_FILE_PATH" ]; then
  set -a
  source "$ENV_FILE_PATH"
  set +a
  echo "[Genuine Test Server] Loaded environment from $ENV_FILE_PATH"
fi

if [ "${TEST_ENV:-}" = "production" ]; then
  echo "[Genuine Test Server] Production E2E is disabled. Use staging."
  exit 1
fi

# Genuine lane uses ASK_LARS_KEY as the only accepted key name.
# No fallback to ANTHROPIC_API_KEY/ANTH_API_SECRET is allowed here.
if [ -z "${ASK_LARS_KEY:-}" ]; then
  echo "[Genuine Test Server] ASK_LARS_KEY is required for genuine E2E tests."
  echo "[Genuine Test Server] Export ASK_LARS_KEY before running bun run test:e2e:genuine."
  exit 1
fi

# Force a single key source for this lane.
unset ANTHROPIC_API_KEY
unset ANTH_API_SECRET
export ANTHROPIC_API_KEY="$ASK_LARS_KEY"
export CLAUDE_MODEL=claude-haiku-4-5
export STREAM_ENV=local

# Important: Explicitly UNSET PLAYWRIGHT_TEST
# Playwright runner sets this automatically, but we need to clear it
# to allow genuine E2E tests to make real API calls
unset PLAYWRIGHT_TEST

echo "[Genuine Test Server] Starting on port 9548 (genuine API mode)"
echo "[Genuine Test Server] ⚠️  REAL API CALLS ENABLED - will consume credits/tokens"
echo "[Genuine Test Server] PLAYWRIGHT_TEST unset - real API calls allowed"
echo "[Genuine Test Server] Key source: ASK_LARS_KEY (mapped to ANTHROPIC_API_KEY)"
echo "[Genuine Test Server] Policy: ASK_LARS_KEY is genuine-E2E-only and forbidden for any other agent use"
echo "[Genuine Test Server] Model: ${CLAUDE_MODEL}"

exec bun x --bun next dev -p 9548
