#!/usr/bin/env bash
# Run all core package tests in parallel, then apps/web tests.
# Fails immediately if any package test fails.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGES=(shared tools oauth-core automation-engine alrighty alive-tagger images site-controller)
PIDS=()
FAILED=0

# Run package tests in parallel
for pkg in "${PACKAGES[@]}"; do
  (cd "$REPO_ROOT/packages/$pkg" && bun run test) &
  PIDS+=($!)
done

# Wait for all and track failures
for pid in "${PIDS[@]}"; do
  if ! wait "$pid"; then
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "❌ Package tests failed"
  exit 1
fi

# Run apps/web tests (heaviest — runs after packages pass)
cd "$REPO_ROOT/apps/web" && bun run test
