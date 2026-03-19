#!/bin/bash
# Show all sites and their current deployment modes

OVERRIDE_DIR="/etc/systemd/system"
SITES_DIR="/srv/webalive/sites"

echo "WebAlive Site Deployment Modes"
echo "=============================="
echo ""

printf "%-40s %-15s %-15s\n" "DOMAIN" "EXPECTED" "ACTUAL"
printf "%-40s %-15s %-15s\n" "------" "--------" "------"

for SITE_PATH in "$SITES_DIR"/*; do
  if [ ! -d "$SITE_PATH" ]; then
    continue
  fi

  DOMAIN=$(basename "$SITE_PATH")
  SLUG=$(echo "$DOMAIN" | sed 's/\./-/g')
  SERVICE="site@${SLUG}.service"
  SERVICE_DIR="$OVERRIDE_DIR/${SERVICE}.d"

  # Get actual mode: serve-mode.conf is canonical, override.conf is legacy fallback
  if [ -f "$SERVICE_DIR/serve-mode.conf" ]; then
    ACTUAL=$(grep -oP "bun run \K\w+" "$SERVICE_DIR/serve-mode.conf" 2>/dev/null || echo "unknown")
  elif [ -f "$SERVICE_DIR/override.conf" ]; then
    ACTUAL=$(grep -oP "bun run \K\w+" "$SERVICE_DIR/override.conf" 2>/dev/null || echo "default")
  else
    ACTUAL="default"
  fi

  # Get expected mode from registry
  REGISTRY="/var/lib/webalive/site-modes.json"
  if [ -f "$REGISTRY" ]; then
    EXPECTED=$(jq -r ".sites.\"$DOMAIN\"" "$REGISTRY" 2>/dev/null || echo "?")
  else
    EXPECTED="?"
  fi

  # Highlight mismatches
  if [ "$ACTUAL" != "$EXPECTED" ] && [ "$EXPECTED" != "?" ]; then
    printf "%-40s %-15s %-15s [MISMATCH]\n" "$DOMAIN" "$EXPECTED" "$ACTUAL"
  else
    printf "%-40s %-15s %-15s\n" "$DOMAIN" "$EXPECTED" "$ACTUAL"
  fi
done

echo ""
echo "Commands:"
echo "  set-site-mode.sh <domain> <dev|preview|start>  - Change a site's mode"
echo "  verify-site-modes.sh                           - Check and fix all mismatches"
