#!/bin/bash
# =============================================================================
# Routing Smoke Test
# =============================================================================
# Fast (<5s) verification that all critical routing paths work.
# Checks: production, staging, widget, images, preview fallback, sites.
#
# Run manually, post-deploy, post-tunnel-sync, or via cron.
# Exit code: 0 = all pass, 1 = at least one failure.
#
# Usage: ./routing-smoke.sh [--verbose]
# =============================================================================

set -uo pipefail

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
    local body
    body=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null) || body="000"
    http_code="$body"

    # For content checks, we need the actual body
    if [[ -n "$content_check" && "$http_code" == "$expected_code" ]]; then
        local actual_body
        actual_body=$(curl -sf --max-time 10 "$url" 2>/dev/null) || actual_body=""
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

# Production
check "production /api/health" "https://app.alive.best/api/health" 200 '"status"'
check "production homepage" "https://app.alive.best/" 200

# Staging
check "staging /api/health" "https://staging.alive.best/api/health" 200 '"status"'

# Widget
check_content_type "widget.js" "https://widget.alive.best/widget.js" "javascript"

# Manager
check "manager" "https://mg.alive.best/" 200

# Image serving (via internal Caddy)
# Use a known test image if available, otherwise just check the path doesn't return HTML
check_content_type "site images" "https://blank.alive.best/_images/placeholder.txt" "text"

# Preview fallback (unknown subdomain should not 404 from tunnel catch-all)
# It should hit internal Caddy → preview-proxy, which returns 401/403 without JWT
check "preview fallback" "https://nonexistent-smoke-test.alive.best/" 401

echo "================================================"
if [[ $FAILURES -eq 0 ]]; then
    echo "All $CHECKS checks passed"
    exit 0
else
    echo "$FAILURES of $CHECKS checks FAILED"
    exit 1
fi
