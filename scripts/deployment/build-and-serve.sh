#!/bin/bash

# Build and deploy Claude Bridge
#
# Usage: ./scripts/build-and-serve.sh [environment]
# Examples:
#   ./scripts/build-and-serve.sh prod        # Deploy to port 9000 (systemd)
#   ./scripts/build-and-serve.sh staging     # Deploy to port 8998 (systemd)
#
# Dev environment uses hot-reload (next dev) - use ./scripts/deploy-dev.sh instead
#
# ZERO-DOWNTIME DEPLOYMENT:
# 1. Backup current build before building new version
# 2. If build fails: restore backup, keep old service running
# 3. If build succeeds: restart systemd service
# 4. If health check fails: automatic rollback to backup
#
# This ensures that build failures never break the running application

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Timing tracking
DEPLOY_START_TIME=$(date +%s)
PHASE_START_TIME=$DEPLOY_START_TIME
CURRENT_PHASE=0
TOTAL_PHASES=8

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

# Environment-aware health check timeout
if [ "$ENV" = "staging" ]; then
    MAX_WAIT=60  # Staging may be slower (shared resources, network latency)
else
    MAX_WAIT=30  # Production expects fast startup
fi

STANDALONE_SERVER_PATH=".builds/${ENV}/current/standalone/apps/web/server.js"

cd "$PROJECT_ROOT"

# Timing functions
get_elapsed_time() {
    local start_time=$1
    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))
    echo "${elapsed}s"
}

get_total_elapsed() {
    get_elapsed_time $DEPLOY_START_TIME
}

# Phase management
start_phase() {
    CURRENT_PHASE=$((CURRENT_PHASE + 1))
    PHASE_START_TIME=$(date +%s)
    echo ""
    echo -e "${BOLD}${CYAN}[${CURRENT_PHASE}/${TOTAL_PHASES}]${NC} ${BOLD}$1${NC}"
    echo -e "${DIM}⏱️  Total elapsed: $(get_total_elapsed)${NC}"
}

end_phase() {
    local status=$1
    local message=$2
    local phase_time=$(get_elapsed_time $PHASE_START_TIME)

    if [ "$status" = "success" ]; then
        echo -e "  ${GREEN}✓${NC} $message ${DIM}(${phase_time})${NC}"
    elif [ "$status" = "warn" ]; then
        echo -e "  ${YELLOW}⚠${NC} $message ${DIM}(${phase_time})${NC}"
    else
        echo -e "  ${RED}✗${NC} $message ${DIM}(${phase_time})${NC}"
    fi
}

# Logging functions (enhanced)
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_step() {
    echo -e "  ${DIM}→${NC} $1"
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

# Extract meaningful errors from output
extract_errors() {
    local output="$1"
    local pattern="$2"

    # Show lines matching error patterns and context
    echo "$output" | grep -E "$pattern" | head -n 20
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

echo ""
echo "═══════════════════════════════════════════════════════"
log_info "Starting deployment: ${BOLD}${APP_NAME}${NC}"
log_info "Environment: ${ENV} | Port: ${PORT}"
echo "═══════════════════════════════════════════════════════"

start_phase "Validating environment"

log_step "Checking .env files..."
if [ ! -f "apps/web/.env" ] && [ ! -f "apps/web/.env.local" ]; then
    log_warn "No .env file found in apps/web/"
fi

log_step "Checking required commands (bun, node)..."
for cmd in bun node; do
    if ! command -v "$cmd" &> /dev/null; then
        end_phase "error" "Required command '$cmd' not found"
        exit 1
    fi
done

log_step "Checking port $PORT availability..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    # Check if this is our systemd service
    SERVICE_NAME="claude-bridge-${ENV}.service"
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_step "Port $PORT in use by systemd (will be restarted)"
    else
        PORT_PROC=$(lsof -Pi :$PORT -sTCP:LISTEN | grep -v "PID" || true)
        end_phase "error" "Port $PORT is in use by unknown process"
        echo "$PORT_PROC"
        exit 1
    fi
fi

end_phase "success" "Environment validated"

start_phase "Installing dependencies"
log_step "Running bun install..."

# Show output but filter excessive noise
if bun install 2>&1 | grep -E "(error|warn|^$|packages installed)" || [ ${PIPESTATUS[0]} -ne 0 ]; then
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        end_phase "error" "Dependency installation failed"
        exit 1
    fi
fi

end_phase "success" "Dependencies installed"

start_phase "Running linter"
log_step "@biomejs/biome check..."

set +e  # Allow capturing exit code
LINT_OUTPUT=$(bun run lint 2>&1)
LINT_EXIT_CODE=$?
set -e

if [ $LINT_EXIT_CODE -ne 0 ]; then
    end_phase "error" "Linter failed"
    echo ""
    log_error "Lint errors found:"
    echo ""
    # Show actual errors (filter out verbose output)
    echo "$LINT_OUTPUT" | grep -E "(error|✖|×)" | head -n 30
    echo ""
    if [ $(echo "$LINT_OUTPUT" | grep -c "error" || echo 0) -gt 30 ]; then
        log_warn "... and more. Run 'bun run lint' to see all issues."
    fi
    echo ""
    log_error "Fix linting errors before proceeding."
    exit 1
fi

end_phase "success" "Linter passed"

start_phase "TypeScript type checking"
log_step "Running type-check across all packages and apps..."

set +e  # Allow capturing exit code
TSC_OUTPUT=$(bun run type-check 2>&1)
TSC_EXIT_CODE=$?
set -e

if [ $TSC_EXIT_CODE -ne 0 ]; then
    end_phase "error" "TypeScript type checking failed"
    echo ""
    log_error "Type errors found:"
    echo ""
    # Show actual errors (first 40 lines of errors)
    echo "$TSC_OUTPUT" | grep -E "error TS[0-9]+" | head -n 40
    echo ""
    TSC_ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo "0")
    if [ "$TSC_ERROR_COUNT" -gt 40 ]; then
        log_warn "... and $(($TSC_ERROR_COUNT - 40)) more errors."
    fi
    log_error "Found $TSC_ERROR_COUNT type errors total"
    echo ""
    log_error "ALL type errors must be fixed (including in test files)."
    log_error "Run 'bun run type-check' to see full details."
    exit 1
fi

end_phase "success" "TypeScript type checking passed (0 errors)"

start_phase "Running unit tests"
log_step "Executing test suite..."

set +e
TEST_OUTPUT=$(bun run unit 2>&1)
TEST_EXIT_CODE=$?
set -e

# Extract test summary
TEST_SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "Test Files|Tests " | tail -n 2 || echo "")
if [ -n "$TEST_SUMMARY" ]; then
    echo "$TEST_SUMMARY" | while read line; do log_step "$line"; done
fi

if [ $TEST_EXIT_CODE -ne 0 ]; then
    end_phase "error" "Unit tests failed"
    echo ""
    log_error "Failed tests:"
    echo ""

    # Try to extract error messages with improved patterns
    # Look for: error:, FAIL, ✗, Error:, expected, received, # Unhandled error
    ERROR_LINES=$(echo "$TEST_OUTPUT" | grep -E "error:|FAIL|✗|Error:|expected|received|# Unhandled error" || echo "")

    if [ -n "$ERROR_LINES" ]; then
        echo "$ERROR_LINES" | head -n 50
        echo ""
        ERROR_COUNT=$(echo "$ERROR_LINES" | wc -l)
        if [ "$ERROR_COUNT" -gt 50 ]; then
            log_warn "... and $(($ERROR_COUNT - 50)) more error lines. Run 'bun run test' to see all."
        fi
    else
        # If grep didn't find anything, show last 30 lines of output
        log_warn "Could not parse test errors. Showing last 30 lines of output:"
        echo ""
        echo "$TEST_OUTPUT" | tail -n 30
    fi

    echo ""
    log_error "Fix test failures before proceeding."
    log_error "Follow docs/testing/TESTING_GUIDE.md for guidance."
    exit 1
fi

end_phase "success" "All unit tests passed"

# Check if E2E tests should be skipped
if [ "${SKIP_E2E:-0}" = "1" ]; then
    log_warn "Skipping E2E tests (SKIP_E2E=1)"
    TOTAL_PHASES=7  # Adjust total phases count
else
    start_phase "Running E2E tests"
    log_step "Playwright tests (this may take 4-7 minutes)..."
    echo ""

    set +e
    (cd apps/web && bun run test:e2e)
    E2E_EXIT_CODE=$?
    set -e

    echo ""

    if [ $E2E_EXIT_CODE -ne 0 ]; then
        end_phase "error" "E2E tests failed"
        echo ""
        log_error "Fix E2E test failures before proceeding."
        exit 1
    fi

    end_phase "success" "All E2E tests passed"
fi

start_phase "Building application"

# Capture current build for potential rollback
DIST_SYMLINK="$PROJECT_ROOT/.builds/${ENV}/current"
PREVIOUS_BUILD=""
if [ -L "$DIST_SYMLINK" ]; then
    PREVIOUS_BUILD=$(readlink "$DIST_SYMLINK")
    log_step "Current active build: $PREVIOUS_BUILD"
fi

log_step "Next.js production build (this may take 1-2 minutes)..."

# Run atomic build (builds to timestamped dir, atomically updates symlink)
set +e
BUILD_OUTPUT=$("$PROJECT_ROOT/scripts/deployment/build-atomic.sh" "$ENV" 2>&1)
BUILD_EXIT_CODE=$?
set -e

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    end_phase "error" "Build failed"
    echo ""
    log_error "Build errors:"
    echo ""
    # Show actual build errors
    echo "$BUILD_OUTPUT" | grep -E "Error:|Failed|error TS" | head -n 30
    echo ""
    log_error "Previous build still active - no changes made"
    log_error "Fix build errors and try again"
    exit 1
fi

# Verify symlink exists
if [ ! -L "$DIST_SYMLINK" ]; then
    end_phase "error" "Build succeeded but dist symlink not found"
    exit 1
fi

NEW_BUILD=$(readlink "$DIST_SYMLINK")
log_step "New build: $NEW_BUILD"

end_phase "success" "Application built successfully"

start_phase "Deploying server"

# Both production and staging use systemd
SERVICE_NAME="claude-bridge-${ENV}.service"
log_step "Restarting systemd service ($SERVICE_NAME)..."
if ! systemctl restart "$SERVICE_NAME"; then
    end_phase "error" "Failed to restart systemd service"
    exit 1
fi

end_phase "success" "Server started"

start_phase "Health check"

log_step "Waiting for server to respond (max ${MAX_WAIT}s)..."
WAITED=0
SERVER_READY=false

while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:$PORT/ >/dev/null 2>&1; then
        SERVER_READY=true
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    if [ $((WAITED % 5)) -eq 0 ]; then
        echo -n "."
    fi
done
echo ""

if [ "$SERVER_READY" = true ]; then
    end_phase "success" "Server responding after ${WAITED}s"
else
    end_phase "error" "Server failed health check after ${MAX_WAIT}s"

    # Rollback to previous build if it exists
    if [ -n "$PREVIOUS_BUILD" ]; then
        log_warn "Attempting rollback to: $PREVIOUS_BUILD"

        if rollback_build "$DIST_SYMLINK" "$PREVIOUS_BUILD" "$ENV"; then
            # Restart systemd service with old build
            SERVICE_NAME="claude-bridge-${ENV}.service"
            if systemctl restart "$SERVICE_NAME" >/dev/null 2>&1; then
                # Verify rollback is serving
                sleep 3
                if curl -sf http://localhost:$PORT/ >/dev/null 2>&1; then
                    log_success "Rollback successful - previous build is serving"
                else
                    log_error "Rollback started but not responding - check logs: journalctl -u $SERVICE_NAME"
                fi
            else
                log_error "Failed to restart after rollback - manual intervention required"
            fi

            log_error "Deploy failed - check logs: journalctl -u $SERVICE_NAME"
        else
            log_error "Rollback failed - manual intervention required"
            log_error "Check logs with: journalctl -u claude-bridge-${ENV}.service"
        fi
    else
        log_error "No previous build to rollback to"
        log_error "This was the first deployment - check logs: journalctl -u claude-bridge-${ENV}.service"
    fi

    exit 1
fi

# Reload Caddy to pick up any routing changes (skip for production)
if [ "$ENV" != "prod" ]; then
    if command -v systemctl &> /dev/null; then
        if systemctl is-active --quiet caddy 2>/dev/null; then
            log_step "Reloading Caddy configuration..."
            if systemctl reload caddy 2>/dev/null; then
                log_step "Caddy reloaded"
            else
                log_warn "Caddy reload failed (non-critical)"
            fi
        fi
    fi
else
    log_step "Skipping Caddy reload for production (manual reload required)"
fi

# Calculate total deployment time
TOTAL_TIME=$(get_total_elapsed)

# Show final status with summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${BOLD}${GREEN}✓ Deployment completed successfully!${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo -e "${BOLD}Summary:${NC}"
echo -e "  Environment:  ${CYAN}${ENV}${NC}"
echo -e "  Application:  ${CYAN}${APP_NAME}${NC}"
echo -e "  Port:         ${CYAN}${PORT}${NC}"
echo -e "  Build:        ${CYAN}${NEW_BUILD}${NC}"
echo -e "  Total time:   ${BOLD}${TOTAL_TIME}${NC}"
echo ""

# ============================================================================
# SHELL-SERVER: Rebuild and restart (shared across all environments)
# ============================================================================
log_step "Rebuilding shell-server..."
cd "$PROJECT_ROOT/apps/shell-server"
if bun run build; then
    log_success "Shell-server built successfully"
    if systemctl is-active --quiet shell-server; then
        log_step "Restarting shell-server systemd service..."
        systemctl restart shell-server
        sleep 2
        if systemctl is-active --quiet shell-server; then
            log_success "Shell-server restarted successfully"
        else
            log_warn "Shell-server failed to start (check: journalctl -u shell-server -n 20)"
        fi
    else
        log_warn "Shell-server systemd service not running, starting it..."
        systemctl start shell-server
    fi
else
    log_warn "Shell-server build failed, skipping restart"
fi
cd "$PROJECT_ROOT"
echo ""

SERVICE_NAME="claude-bridge-${ENV}.service"
echo -e "${BOLD}Status:${NC}"
systemctl status "$SERVICE_NAME" --no-pager -l | head -3
echo ""
echo -e "${BOLD}Commands:${NC}"
echo "  📝 Logs:     journalctl -u $SERVICE_NAME -f"
echo "  🔄 Restart:  systemctl restart $SERVICE_NAME"
echo "  ⏹️  Stop:     systemctl stop $SERVICE_NAME"
echo "  🌐 Access:   http://localhost:$PORT"
echo ""
echo "  📡 Shell:    systemctl status shell-server"
echo ""
