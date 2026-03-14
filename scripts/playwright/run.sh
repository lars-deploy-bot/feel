#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAYWRIGHT_CLI="$PROJECT_ROOT/node_modules/@playwright/test/cli.js"
PLAYWRIGHT_BROWSERS_DIR="${PLAYWRIGHT_BROWSERS_PATH:-}"

fail() {
    echo "[playwright-runner] $1" >&2
    exit 1
}

if [[ ! -f "$PLAYWRIGHT_CLI" ]]; then
    fail "Missing repo-pinned Playwright CLI at $PLAYWRIGHT_CLI. Run 'bun install --frozen-lockfile'."
fi

PLAYWRIGHT_BROWSERS_DIR="$("$SCRIPT_DIR/verify-browsers.sh")"

export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_DIR"
exec node "$PLAYWRIGHT_CLI" "$@"
