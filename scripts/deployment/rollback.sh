#!/bin/bash
set -e

# Interactive rollback to previous build
source "$(dirname "$0")/env-helper.sh"

BUILDS_DIR="/root/webalive/claude-bridge/.builds"
CURRENT_LINK="$BUILDS_DIR/current"

if [ ! -d "$BUILDS_DIR" ]; then
  echo "❌ Builds directory not found: $BUILDS_DIR"
  exit 1
fi

echo "📋 Available builds:"
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

# Restart production
echo "🔄 Restarting production..."
pm2 restart "$ENV_PROD_PROCESS_NAME"
sleep 5

echo "✅ Rollback complete"
echo ""
pm2 describe "$ENV_PROD_PROCESS_NAME"
