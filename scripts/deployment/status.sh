#!/bin/bash
set -e

# Show status of all three environments
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/packages/shared/environments.json"

# Read environment configuration
PROD_PORT=$(jq -r '.environments.production.port' "$ENV_CONFIG")
STAGING_PORT=$(jq -r '.environments.staging.port' "$ENV_CONFIG")
DEV_PORT=$(jq -r '.environments.dev.port' "$ENV_CONFIG")
PROD_SERVICE=$(jq -r '.environments.production.systemdService' "$ENV_CONFIG")
STAGING_SERVICE=$(jq -r '.environments.staging.systemdService' "$ENV_CONFIG")
DEV_SERVICE=$(jq -r '.environments.dev.systemdService' "$ENV_CONFIG")

echo "📊 Claude Bridge Environment Status"
echo "=================================="
echo ""

echo "Production ($PROD_PORT) - $PROD_SERVICE:"
systemctl status "$PROD_SERVICE" --no-pager -l | head -3 || echo "  ❌ Not running"
echo ""

echo "Staging ($STAGING_PORT) - $STAGING_SERVICE:"
systemctl status "$STAGING_SERVICE" --no-pager -l | head -3 || echo "  ❌ Not running"
echo ""

echo "Dev ($DEV_PORT) - $DEV_SERVICE:"
systemctl status "$DEV_SERVICE" --no-pager -l | head -3 || echo "  ❌ Not running"
echo ""

echo "Active production build:"
readlink /root/webalive/claude-bridge/.builds/production/current 2>/dev/null || echo "  ❌ No active build"
echo ""

echo "Active staging build:"
readlink /root/webalive/claude-bridge/.builds/staging/current 2>/dev/null || echo "  ❌ No active build"
