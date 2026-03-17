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
    content_type=$(curl -sS --max-time 10 -o /dev/null -w "%{content_type}" "$url" 2>/dev/null) || content_type=""

    if echo "$content_type" | grep -qi "$expected_type"; then
        [[ "$VERBOSE" == "--verbose" ]] && echo "OK:   $name (type: $content_type)"
    else
        echo "FAIL: $name — expected content-type containing '$expected_type', got '$content_type' ($url)"
        FAILURES=$((FAILURES + 1))
    fi
}

echo "Routing smoke test — $(date -Iseconds)"
echo "================================================"

# --- Derive domain from server-config.json (no hardcoded domains, fail fast) ---
SERVER_CONFIG_PATH="${SERVER_CONFIG_PATH:-/var/lib/alive/server-config.json}"
if [[ ! -f "$SERVER_CONFIG_PATH" ]]; then
    echo "FATAL: server-config.json not found at $SERVER_CONFIG_PATH" >&2
    exit 1
fi
if ! command -v jq &>/dev/null; then
    echo "FATAL: jq is required but not installed" >&2
    exit 1
fi
BASE_DOMAIN=$(jq -re '.domains.main' "$SERVER_CONFIG_PATH")
if [[ -z "$BASE_DOMAIN" ]]; then
    echo "FATAL: domains.main is empty in $SERVER_CONFIG_PATH" >&2
    exit 1
fi

# --- Environment routes (production, staging) ---
# These are structural — always checked.
check "production /api/health" "https://app.${BASE_DOMAIN}/api/health" 200 '"status"'
check "staging /api/health" "https://staging.${BASE_DOMAIN}/api/health" 200 '"status"'

# --- Infrastructure services from the registry ---
# Reads INFRASTRUCTURE_SERVICES from packages/shared and emits check commands.
# Requires bun — fail fast if unavailable (no fallback with duplicated knowledge).
if ! command -v bun &>/dev/null; then
    echo "FATAL: bun is required to read the infrastructure services registry" >&2
    exit 1
fi

INFRA_CHECKS=$(bun -e "
  const { INFRASTRUCTURE_SERVICES } = require('@webalive/shared');
  const baseDomain = '$BASE_DOMAIN';
  for (const svc of INFRASTRUCTURE_SERVICES) {
    if (!svc.healthPath) continue;
    const url = 'https://' + svc.subdomain + '.' + baseDomain + svc.healthPath;
    const ct = svc.healthContentType || '';
    console.log(JSON.stringify({ name: svc.displayName, url, ct }));
  }
" 2>&1)

if [[ $? -ne 0 ]]; then
    echo "FATAL: Failed to read infrastructure services registry: $INFRA_CHECKS" >&2
    exit 1
fi

while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    name=$(echo "$line" | jq -r '.name')
    url=$(echo "$line" | jq -r '.url')
    ct=$(echo "$line" | jq -r '.ct')
    if [[ -n "$ct" ]]; then
        check_content_type "$name" "$url" "$ct"
    else
        check "$name" "$url" 200
    fi
done <<< "$INFRA_CHECKS"

# --- Structural routing checks (not service-specific) ---
# Preview fallback: unknown subdomain should hit preview-proxy (401 or 403), not tunnel 404
CHECKS=$((CHECKS + 1))
preview_code=$(curl -sS --max-time 10 -o /dev/null -w "%{http_code}" "https://nonexistent-smoke-test.${BASE_DOMAIN}/" 2>/dev/null) || preview_code="000"
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
