#!/bin/bash
# =============================================================================
# Smoke test for the supported detached deploy entrypoint.
# =============================================================================
#
# Verifies that:
# - `nohup make staging` starts successfully from a clean state
# - the command acquires the global deploy lock within a short timeout
# - the wrapper reaches ship.sh smoke mode without silently exiting early
#
# This uses smoke mode so it never starts a real deployment.
#
# Usage:
#   ./scripts/deployment/smoke-detached-entrypoint.sh
#
# Exit codes:
#   0 - Detached entrypoint behaved correctly
#   1 - Smoke test failed
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/lock.sh"

LOCK_FILE="/tmp/alive-deploy.lock"
SMOKE_LOG="/tmp/alive-deploy-smoke.log"
START_TIMEOUT_SECONDS=15
SMOKE_HOLD_SECONDS=20

cleanup() {
    if [[ -n "${SMOKE_PID:-}" ]]; then
        kill "$SMOKE_PID" >/dev/null 2>&1 || true
        wait "$SMOKE_PID" >/dev/null 2>&1 || true
    fi
    rm -f "$SMOKE_LOG"
    rm -f "$LOCK_FILE"
}

trap cleanup EXIT INT TERM

if lock_status >/dev/null 2>&1; then
    log_error "Refusing to run smoke test while another deployment is active"
    exit 1
fi

rm -f "$SMOKE_LOG"
rm -f "$LOCK_FILE"

log_info "Starting detached smoke run via: nohup make staging"
ALIVE_DEPLOY_SMOKE_HOLD_LOCK_SECONDS="$SMOKE_HOLD_SECONDS" \
    nohup make staging >"$SMOKE_LOG" 2>&1 &
SMOKE_PID=$!

lock_acquired=false
for _ in $(seq 1 "$START_TIMEOUT_SECONDS"); do
    if [[ -f "$LOCK_FILE" ]]; then
        LOCK_CONTENT="$(cat "$LOCK_FILE")"
        LOCK_PID="$(echo "$LOCK_CONTENT" | cut -d'|' -f1)"
        LOCK_PHASE="$(echo "$LOCK_CONTENT" | cut -d'|' -f4)"

        if [[ "$LOCK_PHASE" == "smoke-hold" ]]; then
            lock_acquired=true
            break
        fi
    fi

    if ! ps -p "$SMOKE_PID" >/dev/null 2>&1; then
        break
    fi

    sleep 1
done

if [[ "$lock_acquired" != "true" ]]; then
    log_error "Detached entrypoint exited without acquiring the deploy lock"
    if [[ -f "$SMOKE_LOG" ]]; then
        echo "--- smoke log ---"
        cat "$SMOKE_LOG"
    fi
    exit 1
fi

if ! ps -p "$LOCK_PID" >/dev/null 2>&1; then
    log_error "Deploy lock owner process is not running (pid=$LOCK_PID)"
    echo "--- smoke log ---"
    cat "$SMOKE_LOG"
    exit 1
fi

if ! grep -Fq "Smoke mode: holding deploy lock" "$SMOKE_LOG"; then
    log_error "Detached entrypoint never reached ship.sh smoke mode"
    echo "--- smoke log ---"
    cat "$SMOKE_LOG"
    exit 1
fi

log_success "Detached entrypoint acquired deploy lock as expected"
wait "$SMOKE_PID"
SMOKE_EXIT_CODE=$?

if [[ "$SMOKE_EXIT_CODE" -ne 0 ]]; then
    log_error "Detached smoke run exited with code $SMOKE_EXIT_CODE"
    echo "--- smoke log ---"
    cat "$SMOKE_LOG"
    exit 1
fi

if [[ -f "$LOCK_FILE" ]]; then
    log_error "Deploy lock still exists after smoke run completed"
    echo "--- smoke log ---"
    cat "$SMOKE_LOG"
    exit 1
fi

log_success "Detached smoke entrypoint completed cleanly"
