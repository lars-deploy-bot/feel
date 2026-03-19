#!/bin/bash
# Verify all sites are running their intended deployment mode
# Runs periodically and at system boot

REGISTRY="/var/lib/webalive/site-modes.json"
OVERRIDE_DIR="/etc/systemd/system"
LOG_FILE="/var/log/webalive-mode-check.log"

log_message() {
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

if [ ! -f "$REGISTRY" ]; then
  log_message "Registry not found, skipping verification"
  exit 0
fi

log_message "Starting deployment mode verification..."

CHECKED=0
MISMATCHES=0

# Get all sites from registry
SITES=$(jq -r '.sites | keys[]' "$REGISTRY" 2>/dev/null)

for DOMAIN in $SITES; do
  SLUG=$(echo "$DOMAIN" | sed 's/\./-/g')
  SERVICE="site@${SLUG}.service"
  SERVICE_DIR="$OVERRIDE_DIR/${SERVICE}.d"

  EXPECTED_MODE=$(jq -r ".sites.\"$DOMAIN\"" "$REGISTRY")

  # Extract actual mode: serve-mode.conf is canonical, override.conf is legacy fallback
  if [ -f "$SERVICE_DIR/serve-mode.conf" ]; then
    ACTUAL_MODE=$(grep -oP "bun run \K\w+" "$SERVICE_DIR/serve-mode.conf" 2>/dev/null || echo "unknown")
  elif [ -f "$SERVICE_DIR/override.conf" ]; then
    ACTUAL_MODE=$(grep -oP "bun run \K\w+" "$SERVICE_DIR/override.conf" 2>/dev/null || echo "dev")
  else
    ACTUAL_MODE="dev"
  fi

  if [ "$ACTUAL_MODE" != "$EXPECTED_MODE" ]; then
    log_message "MISMATCH: $DOMAIN - Expected: $EXPECTED_MODE, Actual: $ACTUAL_MODE"
    MISMATCHES=$((MISMATCHES + 1))

    # Auto-fix if it's a drift
    log_message "Auto-fixing $DOMAIN to $EXPECTED_MODE..."
    /usr/local/bin/set-site-mode.sh "$DOMAIN" "$EXPECTED_MODE" >> "$LOG_FILE" 2>&1
  else
    log_message "OK: $DOMAIN -> $EXPECTED_MODE"
  fi

  CHECKED=$((CHECKED + 1))
done

log_message "Mode verification complete - Checked: $CHECKED, Mismatches fixed: $MISMATCHES"
exit 0
