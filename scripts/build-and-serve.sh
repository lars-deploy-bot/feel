#!/bin/bash

# Build and serve Claude Bridge on PM2 (production mode)
# This script builds the project and serves it on port 8999

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=8999
APP_NAME="claude-bridge"
LOCK_FILE="/tmp/${APP_NAME}-deploy.lock"
MAX_WAIT=30  # Max seconds to wait for health check

# Navigate to project root
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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

log_info "Starting deployment of ${APP_NAME}..."

# Pull latest code from git
log_info "Pulling latest code from git..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    log_info "Current branch: $CURRENT_BRANCH"

    if GIT_SSH_COMMAND='ssh -i ~/.ssh/alive_brug_deploy' git pull origin "$CURRENT_BRANCH"; then
        log_success "Git pull successful"
    else
        log_warn "Git pull failed (continuing with local code)"
    fi
else
    log_warn "Not a git repository, skipping pull"
fi

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
    PORT_PROC=$(lsof -Pi :$PORT -sTCP:LISTEN | grep -v "PID" || true)
    if echo "$PORT_PROC" | grep -q "PM2"; then
        log_warn "Port $PORT is in use by PM2 (will be replaced)"
    else
        log_error "Port $PORT is in use by another process:"
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

# Build the project
log_info "Running build..."
BUILD_START=$(date +%s)
if ! bun run build; then
    log_error "Build failed"
    exit 1
fi
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
log_success "Build completed in ${BUILD_TIME}s"

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

# Remove lock files
rm -f apps/web/.next/dev/lock 2>/dev/null || true

# Start the production server
log_info "Starting production server on port $PORT..."
cd apps/web

if ! pm2 start "bun next start -p $PORT" --name "$APP_NAME" >/dev/null 2>&1; then
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
else
    log_error "Server failed health check after ${MAX_WAIT}s"
    log_error "Check logs with: pm2 logs $APP_NAME"
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
log_success "Deployment completed successfully!"
echo "═══════════════════════════════════════════════════════"
echo ""
pm2 status
echo ""
echo "📝 Logs:     pm2 logs $APP_NAME"
echo "🔄 Restart:  pm2 restart $APP_NAME"
echo "⏹️  Stop:     pm2 stop $APP_NAME"
echo "🌐 Access:   http://localhost:$PORT"
echo ""
