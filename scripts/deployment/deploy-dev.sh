#!/bin/bash
set -e

# Development environment deployment (hot-reload mode)
# Rebuilds packages + restarts dev server

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/environments.json"

# Read dev configuration
DEV_PORT=$(jq -r '.environments.dev.port' "$ENV_CONFIG")
DEV_PROCESS=$(jq -r '.environments.dev.processName' "$ENV_CONFIG")

echo "🔄 Rebuilding packages and restarting dev environment..."

bun run lint
echo "✅ Linting complete"

bun run type-check
echo "✅ Type checking complete"

cd packages/images && bun run build && cd ../..
echo "✅ Images built"

cd packages/tools && bun run build && cd ../..
echo "✅ Tools built"

# Clean Next.js build cache to prevent corrupted manifest issues
echo "🧹 Cleaning Next.js build cache..."
rm -rf apps/web/.next
echo "✅ Build cache cleaned"

pm2 restart "$DEV_PROCESS" --update-env
echo "✅ Dev server restarted"

sleep 5

echo "🔐 Verifying dev server is responding to API calls..."
curl -f -X POST "http://localhost:$DEV_PORT/api/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"eedenlars@gmail.com","password":"supersecret"}' > /dev/null 2>&1 && \
  echo "✅ Dev server health check passed (API responding)" || \
  echo "⚠️  Dev server health check failed (API not responding)"

pm2 describe "$DEV_PROCESS"

# Rebuild and restart shell-server (shared across all environments)
echo ""
echo "📡 Rebuilding shell-server..."
cd apps/shell-server
if bun run build; then
    echo "✅ Shell-server built"
    systemctl restart shell-server
    sleep 2
    systemctl is-active --quiet shell-server && \
      echo "✅ Shell-server restarted" || \
      echo "⚠️  Shell-server failed to start (check: journalctl -u shell-server -n 20)"
else
    echo "⚠️  Shell-server build failed"
fi
cd ../..
