#!/bin/bash
set -e

# Development environment deployment (hot-reload mode)
# Rebuilds packages + restarts dev server
# Note: Dev runs on port 8997 with hot-reload (next dev), not production build

echo "🔄 Rebuilding packages and restarting dev environment..."

bun run lint
echo "✅ Linting complete"

cd packages/images && bun run build && cd ../..
echo "✅ Images built"

cd packages/tools && bun run build && cd ../..
echo "✅ Tools built"

pm2 restart claude-bridge-dev --update-env
echo "✅ Dev server restarted"

sleep 5

echo "🔐 Verifying dev server is responding to API calls..."
curl -f -X POST http://localhost:8997/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"eedenlars@gmail.com","password":"supersecret"}' > /dev/null 2>&1 && \
  echo "✅ Dev server health check passed (API responding)" || \
  echo "⚠️  Dev server health check failed (API not responding)"

pm2 describe claude-bridge-dev
