#!/bin/bash
set -e

# Show status of all three environments
source "$(dirname "$0")/env-helper.sh"

echo "📊 Claude Bridge Environment Status"
echo "=================================="
echo ""

echo "Production ($ENV_PROD_PORT) - $ENV_PROD_PROCESS_NAME:"
pm2 describe "$ENV_PROD_PROCESS_NAME" 2>/dev/null || echo "  ❌ Not running"
echo ""

echo "Staging ($ENV_STAGING_PORT) - $ENV_STAGING_PROCESS_NAME:"
pm2 describe "$ENV_STAGING_PROCESS_NAME" 2>/dev/null || echo "  ❌ Not running"
echo ""

echo "Dev ($ENV_DEV_PORT) - $ENV_DEV_PROCESS_NAME:"
pm2 describe "$ENV_DEV_PROCESS_NAME" 2>/dev/null || echo "  ❌ Not running"
echo ""

echo "Active production build:"
readlink /root/webalive/claude-bridge/.builds/prod/current 2>/dev/null || echo "  ❌ No active build"
echo ""

echo "Active staging build:"
readlink /root/webalive/claude-bridge/.builds/staging/current 2>/dev/null || echo "  ❌ No active build"
