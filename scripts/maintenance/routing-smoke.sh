#!/bin/bash
# =============================================================================
# Routing Smoke Test
# =============================================================================
# Fast (<5s) verification that all critical routing paths work.
# Derives infrastructure service checks from the registry in
# packages/shared/src/infrastructure-services.ts — no hardcoded hostname list.
#
# Deletable when a proper health-check service exists, with zero downstream impact.
# Only reads state (curl, check status codes), never mutates anything.
#
# Run manually, post-deploy, post-tunnel-sync, or via cron.
# Exit code: 0 = all pass, 1 = at least one failure.
#
# Usage: ./routing-smoke.sh [--verbose]
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERBOSE="${1:-}"
FAILURES=0
CHECKS=0

check() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    local content_check="${4:-}"
    CHECKS=$((CHECKS + 1))

    local http_code
    http_code=$(curl -sS --max-time 10 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null) || http_code="000"

    # For content checks, we need the actual body
    if [[ -n "$content_check" && "$http_code" == "$expected_code" ]]; then
        local actual_body
        actual_body=$(curl -sS --max-time 10 "$url" 2>/dev/null) || actual_body=""
        if ! echo "$actual_body" | grep -q "$content_check"; then
            echo "FAIL: $name — got $http_code but content missing: $content_check"
            FAILURES=$((FAILURES + 1))
            return
        fi
    fi

    if [[ "$http_code" == "$expected_code" ]]; then
        [[ "$VERBOSE" == "--verbose" ]] && echo "OK:   $name ($http_code)"
    else
        echo "FAIL: $name — expected $expected_code, got $http_code ($url)"
        FAILURES=$((FAILURES + 1))
    fi
}

check_content_type() {
    local name="$1"
    local url="$2"
    local expected_type="$3"
    CHECKS=$((CHECKS + 1))

    local content_type
    content_type=$(curl -sf --max-time 10 -o /dev/null -w "%{content_type}" "$url" 2>/dev/null) || content_type=""

    if echo "$content_type" | grep -qi "$expected_type"; then
        [[ "$VERBOSE" == "--verbose" ]] && echo "OK:   $name (type: $content_type)"
    else
        echo "FAIL: $name — expected content-type containing '$expected_type', got '$content_type' ($url)"
        FAILURES=$((FAILURES + 1))
    fi
}

echo "Routing smoke test — $(date -Iseconds)"
echo "================================================"

# --- Environment routes (production, staging) ---
# These are structural — always checked.
check "production /api/health" "https://app.alive.best/api/health" 200 '"status"'
check "staging /api/health" "https://staging.alive.best/api/health" 200 '"status"'

# --- Infrastructure services from the registry ---
# Reads INFRASTRUCTURE_SERVICES from packages/shared and emits check commands.
# Falls back to a minimal hardcoded set if bun is unavailable.
if command -v bun &>/dev/null && [[ -f "$PROJECT_ROOT/packages/shared/src/infrastructure-services.ts" ]]; then
    INFRA_CHECKS=$(bun -e "
      const { INFRASTRUCTURE_SERVICES } = require('@webalive/shared');
      for (const svc of INFRASTRUCTURE_SERVICES) {
        if (!svc.healthPath) continue;
        const url = 'https://' + svc.hostname + svc.healthPath;
        const ct = svc.healthContentType || '';
        console.log(JSON.stringify({ name: svc.displayName, url, ct }));
      }
    " 2>/dev/null) || INFRA_CHECKS=""

    if [[ -n "$INFRA_CHECKS" ]]; then
        while IFS= read -r line; do
            name=$(echo "$line" | jq -r '.name')
            url=$(echo "$line" | jq -r '.url')
            ct=$(echo "$line" | jq -r '.ct')
            if [[ -n "$ct" ]]; then
                check_content_type "$name" "$url" "$ct"
            else
                check "$name" "$url" 200
            fi
        done <<< "$INFRA_CHECKS"
    fi
else
    # Minimal fallback if bun/registry unavailable (e.g., running on a bare server)
    check_content_type "widget.js" "https://widget.alive.best/widget.js" "javascript"
    check "manager" "https://mg.alive.best/" 200
fi

# --- Structural routing checks (not service-specific) ---
# Preview fallback: unknown subdomain should hit preview-proxy (401 or 403), not tunnel 404
CHECKS=$((CHECKS + 1))
preview_code=$(curl -sS --max-time 10 -o /dev/null -w "%{http_code}" "https://nonexistent-smoke-test.alive.best/" 2>/dev/null) || preview_code="000"
if [[ "$preview_code" == "401" || "$preview_code" == "403" ]]; then
    [[ "$VERBOSE" == "--verbose" ]] && echo "OK:   preview fallback ($preview_code)"
else
    echo "FAIL: preview fallback — expected 401 or 403, got $preview_code"
    FAILURES=$((FAILURES + 1))
fi

echo "================================================"
if [[ $FAILURES -eq 0 ]]; then
    echo "All $CHECKS checks passed"
    exit 0
else
    echo "$FAILURES of $CHECKS checks FAILED"
    exit 1
fi
