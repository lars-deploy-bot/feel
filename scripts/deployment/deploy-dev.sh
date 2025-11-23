#!/bin/bash
set -e

# Development environment deployment (hot-reload mode)
# Rebuilds packages + restarts dev server

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/packages/shared/environments.json"

# Validate HOSTED_ENV is set
if [ -z "$HOSTED_ENV" ]; then
    echo "❌ Error: HOSTED_ENV environment variable is not set"
    echo ""
    echo "Please set HOSTED_ENV to either 'server' or 'computer':"
    echo "  export HOSTED_ENV=server    # For production server with PM2"
    echo "  export HOSTED_ENV=computer  # For local development"
    echo ""
    echo "Add to your shell profile (~/.bashrc, ~/.zshrc) or conductor.json to make it permanent."
    exit 1
fi

# Validate HOSTED_ENV value
if [ "$HOSTED_ENV" != "server" ] && [ "$HOSTED_ENV" != "computer" ]; then
    echo "❌ Error: HOSTED_ENV must be either 'server' or 'computer'"
    echo "   Current value: '$HOSTED_ENV'"
    exit 1
fi

# If running on computer (local dev), use simple workflow
if [ "$HOSTED_ENV" = "computer" ]; then
    echo "💻 Computer environment detected (HOSTED_ENV=computer)"
    echo "🔄 Building packages and starting dev server..."

    make static-check
    echo "✅ Static checks complete"

    # Clean Next.js build cache
    echo "🧹 Cleaning Next.js build cache..."
    rm -rf "$PROJECT_ROOT/apps/web/.next"
    echo "✅ Build cache cleaned"

    # Start dev server
    echo "🚀 Starting Next.js dev server..."
    cd "$PROJECT_ROOT/apps/web"
    exec bun run dev
fi

# Server environment - proceed with PM2 deployment
echo "🖥️  Server environment detected (HOSTED_ENV=server)"

# Read dev configuration
DEV_PORT=$(jq -r '.environments.dev.port' "$ENV_CONFIG")
DEV_PROCESS=$(jq -r '.environments.dev.processName' "$ENV_CONFIG")

echo "🔄 Rebuilding packages and restarting dev environment..."

make static-check
echo "✅ Static checks complete"

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
