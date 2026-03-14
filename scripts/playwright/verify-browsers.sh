#!/usr/bin/env bash
set -euo pipefail

ENV_FILE_PATH="${ENV_FILE:-}"
PLAYWRIGHT_BROWSERS_DIR="${PLAYWRIGHT_BROWSERS_PATH:-}"

fail() {
    echo "[playwright-runner] $1" >&2
    exit 1
}

normalize_env_value() {
    local value="$1"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    printf '%s' "$value"
}

if [[ -z "$PLAYWRIGHT_BROWSERS_DIR" && -n "$ENV_FILE_PATH" ]]; then
    if [[ "$ENV_FILE_PATH" != /* ]]; then
        ENV_FILE_PATH="$(pwd)/$ENV_FILE_PATH"
    fi

    if [[ -f "$ENV_FILE_PATH" ]]; then
        PLAYWRIGHT_BROWSERS_DIR="$(
            grep '^PLAYWRIGHT_BROWSERS_PATH=' "$ENV_FILE_PATH" | tail -n 1 | cut -d'=' -f2- || true
        )"
        PLAYWRIGHT_BROWSERS_DIR="$(normalize_env_value "$PLAYWRIGHT_BROWSERS_DIR")"
    fi
fi

INSTALL_HINT="Install Chromium with: PLAYWRIGHT_BROWSERS_PATH=/absolute/browser/cache bunx playwright install chromium"

if [[ -z "$PLAYWRIGHT_BROWSERS_DIR" ]]; then
    fail "PLAYWRIGHT_BROWSERS_PATH must be set explicitly, either in the environment or in ENV_FILE. $INSTALL_HINT"
fi

if [[ ! -d "$PLAYWRIGHT_BROWSERS_DIR" ]]; then
    fail "PLAYWRIGHT_BROWSERS_PATH does not exist: $PLAYWRIGHT_BROWSERS_DIR. $INSTALL_HINT"
fi

if ! find "$PLAYWRIGHT_BROWSERS_DIR" -maxdepth 1 -type d \( -name 'chromium-*' -o -name 'chromium_headless_shell-*' \) | grep -q .; then
    fail "PLAYWRIGHT_BROWSERS_PATH has no Chromium browser payloads: $PLAYWRIGHT_BROWSERS_DIR. $INSTALL_HINT"
fi

printf '%s\n' "$PLAYWRIGHT_BROWSERS_DIR"
