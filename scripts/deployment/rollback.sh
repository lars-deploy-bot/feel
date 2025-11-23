#!/bin/bash
set -e

# Interactive rollback to previous build
# Works for production and staging (both use systemd)

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/packages/shared/environments.json"

# Read environment configuration
PROD_PORT=$(jq -r '.environments.production.port' "$ENV_CONFIG")
STAGING_PORT=$(jq -r '.environments.staging.port' "$ENV_CONFIG")
PROD_SERVICE=$(jq -r '.environments.production.systemdService' "$ENV_CONFIG")
STAGING_SERVICE=$(jq -r '.environments.staging.systemdService' "$ENV_CONFIG")

echo "Select environment to rollback:"
echo "  1) Production (port $PROD_PORT)"
echo "  2) Staging (port $STAGING_PORT)"
read -p "Enter choice (1-2): " env_choice

case $env_choice in
  1)
    ENV="prod"
    SERVICE="$PROD_SERVICE"
    ;;
  2)
    ENV="staging"
    SERVICE="$STAGING_SERVICE"
    ;;
  *)
    echo "❌ Invalid selection"
    exit 1
    ;;
esac

BUILDS_DIR="/root/webalive/claude-bridge/.builds/${ENV}"
CURRENT_LINK="$BUILDS_DIR/current"

if [ ! -d "$BUILDS_DIR" ]; then
  echo "❌ Builds directory not found: $BUILDS_DIR"
  exit 1
fi

echo ""
echo "📋 Available builds for ${ENV}:"
echo ""

cd "$BUILDS_DIR"
ls -dt dist.* | head -10 | nl

echo ""
read -p "Select build number to rollback to (or Ctrl+C to cancel): " choice

# Convert choice to directory name
BUILD_TO_ROLLBACK=$(ls -dt dist.* | head -10 | sed -n "${choice}p")

if [ -z "$BUILD_TO_ROLLBACK" ]; then
  echo "❌ Invalid selection"
  exit 1
fi

echo ""
echo "🔄 Rolling back to: $BUILD_TO_ROLLBACK"
echo ""

# Show what we're rolling back from
CURRENT=$(readlink current)
echo "Current:  $CURRENT"
echo "Target:   $BUILD_TO_ROLLBACK"
echo ""

read -p "Continue with rollback? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Cancelled"
  exit 0
fi

# Perform atomic swap
ln -sfn "$BUILD_TO_ROLLBACK" current
echo "✅ Symlink updated"

# Restart service
echo "🔄 Restarting $SERVICE..."
systemctl restart "$SERVICE"
sleep 5

echo "✅ Rollback complete"
echo ""
systemctl status "$SERVICE" --no-pager | head -10
