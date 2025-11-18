#!/bin/bash

# Build and serve Claude Bridge on PM2 (production mode)
#
# Usage: ./scripts/build-and-serve.sh [environment]
# Examples:
#   ./scripts/build-and-serve.sh prod        # Deploy to port 8999
#   ./scripts/build-and-serve.sh staging     # Deploy to port 8998
#
# Dev environment uses hot-reload (next dev) - use ./scripts/deploy-dev.sh instead
#
# ZERO-DOWNTIME DEPLOYMENT:
# 1. Backup current build before building new version
# 2. If build fails: restore backup, keep old PM2 running
# 3. If build succeeds: stop old PM2, start new PM2
# 4. If health check fails: automatic rollback to backup
#
# This ensures that build failures never break the running application

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration from single source of truth
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/bridge.config.js"
ENV_CONFIG="$PROJECT_ROOT/environments.config.ts"

# Get environment parameter (default: prod)
ENV="${1:-prod}"
if [[ ! "$ENV" =~ ^(prod|staging)$ ]]; then
    echo -e "${RED}[ERROR]${NC} Invalid environment: $ENV. Must be 'prod' or 'staging'"
    echo -e "${RED}[ERROR]${NC} Dev environment uses hot-reload (next dev) - use ./scripts/deploy-dev.sh instead"
    exit 1
fi

# Map environment names to config keys
case "$ENV" in
    prod)
        CONFIG_KEY="production"
        ;;
    staging|dev)
        CONFIG_KEY="$ENV"
        ;;
esac

# Extract port and app name from config file
PORT=$(node -p "require('$CONFIG_FILE').ports.${CONFIG_KEY}")
APP_NAME=$(node -p "require('$CONFIG_FILE').appName.${CONFIG_KEY}")
LOCK_FILE="/tmp/${APP_NAME}-deploy.lock"
MAX_WAIT=30  # Max seconds to wait for health check
STANDALONE_SERVER_PATH=".builds/${ENV}/current/standalone/apps/web/server.js"

cd "$PROJECT_ROOT"

# Logging function
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Start PM2 process with standalone server
start_pm2_server() {
    local port="$1"
    local app_name="$2"
    local env_dir="$3"

    PORT="$port" BRIDGE_API_PORT="$port" NODE_ENV="production" pm2 start "$PROJECT_ROOT/$STANDALONE_SERVER_PATH" \
        --name "$app_name" \
        --interpreter bun \
        --cwd "$PROJECT_ROOT/.builds/${env_dir}/current/standalone" \
        --update-env
}

# Rollback to previous build by switching symlink
rollback_build() {
    local symlink="$1"
    local previous_build="$2"
    local env_dir="$3"

    if [ -z "$previous_build" ] || [ ! -d ".builds/${env_dir}/$previous_build" ]; then
        log_error "Previous build not found: $previous_build"
        return 1
    fi

    log_warn "Rolling back to previous build: $previous_build"
    cd ".builds/${env_dir}"
    ln -sfn "$previous_build" "current"
    cd "$PROJECT_ROOT"

    log_success "Symlink rolled back to: $previous_build"
    return 0
}

# Cleanup function
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# Check if deployment is already running
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        log_error "Deployment already in progress (PID: $PID)"
        exit 1
    else
        log_warn "Stale lock file found, removing..."
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

log_info "Starting deployment of ${APP_NAME} (${ENV} environment, port ${PORT})..."

# Validate environment
log_info "Validating environment..."

if [ ! -f "apps/web/.env" ] && [ ! -f "apps/web/.env.local" ]; then
    log_warn "No .env file found in apps/web/"
fi

# Check required commands
for cmd in bun pm2 node; do
    if ! command -v "$cmd" &> /dev/null; then
        log_error "Required command '$cmd' not found"
        exit 1
    fi
done

# Check if port is available (excluding our own PM2 process)
log_info "Checking port $PORT availability..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    # Check if this is our PM2-managed process
    if pm2 list | grep -q "claude-bridge.*online"; then
        log_warn "Port $PORT is in use by PM2 (will be replaced)"
    else
        PORT_PROC=$(lsof -Pi :$PORT -sTCP:LISTEN | grep -v "PID" || true)
        log_error "Port $PORT is in use by non-PM2 process:"
        echo "$PORT_PROC"
        exit 1
    fi
fi

# Install dependencies
log_info "Installing dependencies..."
if ! bun install; then
    log_error "Dependency installation failed"
    exit 1
fi

# Run linter before tests
log_info "Running linter..."
LINT_OUTPUT=$(bun run lint 2>&1)
LINT_EXIT_CODE=$?

if [ $LINT_EXIT_CODE -ne 0 ]; then
    log_error "Linter failed - deployment aborted"
    echo ""
    log_warn "Showing linter output:"
    echo "$LINT_OUTPUT"
    echo ""
    log_error "Fix linting errors before proceeding. Run 'bun run lint' to see all issues."
    exit 1
fi
log_success "Linter passed"

# Run tests before building
log_info "Running tests..."
TEST_OUTPUT=$(bun run test 2>&1)
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -ne 0 ]; then
    log_error "Tests failed - deployment aborted"
    echo ""
    log_warn "Showing last 100 lines of test output:"
    echo "$TEST_OUTPUT" | tail -n 100
    echo ""
    log_error "You should fix the tests before proceeding. Do it cleanly, and only make tests that are actually good."
    log_error "Do not write tests that are nonsense. Make sure to always follow the docs/testing/TESTING_GUIDE.md"
    exit 1
fi
log_success "All tests passed"

# Capture current build for potential rollback
DIST_SYMLINK="$PROJECT_ROOT/.builds/${ENV}/current"
PREVIOUS_BUILD=""
if [ -L "$DIST_SYMLINK" ]; then
    PREVIOUS_BUILD=$(readlink "$DIST_SYMLINK")
    log_info "Current active build: $PREVIOUS_BUILD"
fi

# Run atomic build (builds to timestamped dir, atomically updates symlink)
log_info "Running atomic build for ${ENV} environment..."
if ! "$PROJECT_ROOT/scripts/deployment/build-atomic.sh" "$ENV"; then
    log_error "Atomic build failed"
    log_info "Previous build still active - no changes made"
    log_error "Deploy aborted - fix build errors and try again"
    exit 1
fi

log_success "Atomic build completed successfully"

# Verify symlink exists
if [ ! -L "$DIST_SYMLINK" ]; then
    log_error "Build succeeded but dist symlink not found"
    exit 1
fi

NEW_BUILD=$(readlink "$DIST_SYMLINK")
log_success "New build active: $NEW_BUILD"

# Stop existing PM2 process gracefully
log_info "Stopping existing PM2 process..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 stop "$APP_NAME" >/dev/null 2>&1 || true
    sleep 2  # Give it time to stop gracefully
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    log_success "Stopped existing process"
else
    log_info "No existing process found"
fi

# Kill any orphaned Next.js processes
NEXT_PIDS=$(pgrep -f "next start" || true)
if [ -n "$NEXT_PIDS" ]; then
    log_warn "Killing orphaned Next.js processes: $NEXT_PIDS"
    pkill -f "next start" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
fi

# Remove dev lock files (for staging/dev servers only)
rm -f apps/web/.next/dev/lock 2>/dev/null || true

# Start the production server
log_info "Starting ${ENV} server on port $PORT..."

# Use standalone server (recommended for output: standalone mode)
if ! start_pm2_server "$PORT" "$APP_NAME" "$ENV" >/dev/null 2>&1; then
    log_error "Failed to start PM2 process"
    exit 1
fi

log_success "PM2 process started"

# Wait for server to be ready
log_info "Waiting for server to respond..."
WAITED=0
SERVER_READY=false

while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:$PORT/ >/dev/null 2>&1; then
        SERVER_READY=true
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    echo -n "."
done
echo ""

if [ "$SERVER_READY" = true ]; then
    log_success "Server is responding (after ${WAITED}s)"
    log_success "Deployment successful - build $NEW_BUILD is active"
else
    log_error "Server failed health check after ${MAX_WAIT}s"

    # Stop failed process
    pm2 stop "$APP_NAME" >/dev/null 2>&1 || true
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true

    # Rollback to previous build if it exists
    if [ -n "$PREVIOUS_BUILD" ]; then
        if rollback_build "$DIST_SYMLINK" "$PREVIOUS_BUILD" "$ENV"; then
            log_warn "Attempting to restart with previous build..."

            # Restart with old build using standalone server
            if start_pm2_server "$PORT" "$APP_NAME" "$ENV" >/dev/null 2>&1; then
                # Verify rollback is serving
                sleep 3
                if curl -sf http://localhost:$PORT/ >/dev/null 2>&1; then
                    log_success "Rollback successful - previous build is serving"
                    pm2 save >/dev/null 2>&1 || true
                else
                    log_error "Rollback started but not responding - check logs: pm2 logs $APP_NAME"
                fi
            else
                log_error "Failed to restart after rollback - manual intervention required"
            fi

            log_error "Deploy failed - check logs: pm2 logs $APP_NAME"
        else
            log_error "Rollback failed - manual intervention required"
            log_error "Check logs with: pm2 logs $APP_NAME"
        fi
    else
        log_error "No previous build to rollback to"
        log_error "This was the first deployment - check logs: pm2 logs $APP_NAME"
    fi

    exit 1
fi

# Reload Caddy to pick up any routing changes
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet caddy 2>/dev/null; then
        log_info "Reloading Caddy..."
        if systemctl reload caddy 2>/dev/null; then
            log_success "Caddy reloaded"
        else
            log_warn "Caddy reload failed (non-critical)"
        fi
    fi
fi

# Save PM2 configuration
pm2 save >/dev/null 2>&1 || true

# Show final status
echo ""
echo "═══════════════════════════════════════════════════════"
log_success "Deployment of ${ENV} completed successfully!"
echo "═══════════════════════════════════════════════════════"
echo ""
pm2 describe "$APP_NAME"
echo ""
echo "📝 Logs:     pm2 logs $APP_NAME"
echo "🔄 Restart:  pm2 restart $APP_NAME"
echo "⏹️  Stop:     pm2 stop $APP_NAME"
echo "🌐 Access:   http://localhost:$PORT"
echo ""
