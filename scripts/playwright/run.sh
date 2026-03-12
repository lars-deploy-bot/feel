#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAYWRIGHT_CLI="$PROJECT_ROOT/node_modules/@playwright/test/cli.js"
PLAYWRIGHT_BROWSERS_DIR="${PLAYWRIGHT_BROWSERS_PATH:-}"
ENV_FILE_PATH="${ENV_FILE:-}"

fail() {
    echo "[playwright-runner] $1" >&2
    exit 1
}

if [[ ! -f "$PLAYWRIGHT_CLI" ]]; then
    fail "Missing repo-pinned Playwright CLI at $PLAYWRIGHT_CLI. Run 'bun install --frozen-lockfile'."
fi

if [[ -z "$PLAYWRIGHT_BROWSERS_DIR" && -n "$ENV_FILE_PATH" ]]; then
    if [[ "$ENV_FILE_PATH" != /* ]]; then
        ENV_FILE_PATH="$(pwd)/$ENV_FILE_PATH"
    fi

    if [[ -f "$ENV_FILE_PATH" ]]; then
        PLAYWRIGHT_BROWSERS_DIR="$(grep '^PLAYWRIGHT_BROWSERS_PATH=' "$ENV_FILE_PATH" | tail -n 1 | cut -d'=' -f2-)"
    fi
fi

if [[ -z "$PLAYWRIGHT_BROWSERS_DIR" ]]; then
    fail "PLAYWRIGHT_BROWSERS_PATH must be set explicitly, either in the environment or in ENV_FILE. Refusing to guess from machine-local caches."
fi

if [[ ! -d "$PLAYWRIGHT_BROWSERS_DIR" ]]; then
    fail "PLAYWRIGHT_BROWSERS_PATH does not exist: $PLAYWRIGHT_BROWSERS_DIR"
fi

if ! find "$PLAYWRIGHT_BROWSERS_DIR" -maxdepth 1 -type d \( -name 'chromium-*' -o -name 'chromium_headless_shell-*' \) | grep -q .; then
    fail "PLAYWRIGHT_BROWSERS_PATH has no Chromium browser payloads: $PLAYWRIGHT_BROWSERS_DIR"
fi

exec node "$PLAYWRIGHT_CLI" "$@"
