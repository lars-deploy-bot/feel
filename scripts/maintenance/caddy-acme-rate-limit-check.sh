#!/bin/bash
# =============================================================================
# Caddy ACME Rate-Limit Alert Check
# =============================================================================
# Detects Let's Encrypt/Caddy ACME rate-limit errors and sends ntfy alerts.
# Intended to run from a systemd timer every few minutes.
# =============================================================================

set -euo pipefail

NTFY_TOPIC="${NTFY_TOPIC:-alive-alerts}"
STATE_FILE="/tmp/alive-caddy-acme-rate-limit.state"

send_alert() {
    local title=$1
    local message=$2
    local priority=${3:-high}

    curl -sf \
        -H "Title: $title" \
        -H "Priority: $priority" \
        -H "Tags: warning" \
        -d "$message" \
        "https://ntfy.sh/$NTFY_TOPIC" > /dev/null 2>&1 || true
}

# Query only recent caddy logs to avoid duplicate notifications.
RATE_LIMIT_LOGS=$(journalctl -u caddy --since "5 minutes ago" --no-pager 2>/dev/null | \
    grep -E "acme:error:rateLimited|too many certificates \\(50\\)|too many failed authorizations" || true)

if [[ -n "$RATE_LIMIT_LOGS" ]]; then
    if [[ ! -f "$STATE_FILE" ]] || [[ "$(cat "$STATE_FILE")" != "active" ]]; then
        FIRST_LINE=$(echo "$RATE_LIMIT_LOGS" | head -n 1)
        send_alert \
            "🟠 Caddy ACME rate-limited" \
            "Caddy hit ACME rate limits. First match: $FIRST_LINE" \
            "high"
        echo "active" > "$STATE_FILE"
    fi

    echo "[caddy-acme-rate-limit] DETECTED"
    echo "$RATE_LIMIT_LOGS"
    exit 0
fi

if [[ -f "$STATE_FILE" ]] && [[ "$(cat "$STATE_FILE")" == "active" ]]; then
    send_alert \
        "🟢 Caddy ACME rate-limit recovered" \
        "No ACME rate-limit log lines detected in the last 5 minutes." \
        "default"
fi

rm -f "$STATE_FILE"
echo "[caddy-acme-rate-limit] OK"
