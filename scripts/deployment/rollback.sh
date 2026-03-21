#!/bin/bash
set -euo pipefail

# Interactive rollback to previous build
# Works for production and staging (both use systemd + deployer-rs)
#
# The deployer-rs layout:
#   .builds/{env}/standalone/  — the LIVE directory (ExecStart points here)
#   .builds/{env}/standalone.old/ — previous build (kept by activate_systemd)
#
# Legacy dist.* directories may also exist from the old build-and-serve.sh path.
# This script supports both layouts.

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/packages/shared/environments.json"

# Verify jq is available
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed"
    exit 1
fi

# Verify configuration file exists
if [[ ! -f "$ENV_CONFIG" ]]; then
    log_error "Configuration file not found: $ENV_CONFIG"
    exit 1
fi

# Read environment configuration
PROD_PORT=$(jq -r '.environments.production.port' "$ENV_CONFIG")
STAGING_PORT=$(jq -r '.environments.staging.port' "$ENV_CONFIG")
PROD_SERVICE=$(jq -r '.environments.production.systemdService' "$ENV_CONFIG")
STAGING_SERVICE=$(jq -r '.environments.staging.systemdService' "$ENV_CONFIG")

echo ""
echo "Select environment to rollback:"
echo "  1) Production (port $PROD_PORT)"
echo "  2) Staging (port $STAGING_PORT)"
read -p "Enter choice (1-2): " env_choice

case $env_choice in
    1)
        ENV="production"
        SERVICE="$PROD_SERVICE"
        PORT="$PROD_PORT"
        ;;
    2)
        ENV="staging"
        SERVICE="$STAGING_SERVICE"
        PORT="$STAGING_PORT"
        ;;
    *)
        log_error "Invalid selection"
        exit 1
        ;;
esac

BUILDS_DIR="$PROJECT_ROOT/.builds/${ENV}"

if [[ ! -d "$BUILDS_DIR" ]]; then
    log_error "Builds directory not found: $BUILDS_DIR"
    exit 1
fi

STANDALONE_DIR="$BUILDS_DIR/standalone"
STANDALONE_OLD="$BUILDS_DIR/standalone.old"

# Check for deployer-rs layout (standalone.old exists)
if [[ -d "$STANDALONE_OLD" ]]; then
    SERVER_JS="$STANDALONE_OLD/apps/web/server.js"
    if [[ ! -f "$SERVER_JS" ]]; then
        log_error "Previous build is invalid — missing server.js: $SERVER_JS"
        exit 1
    fi

    echo ""
    log_info "Deployer-rs rollback: swapping standalone.old → standalone"
    echo ""
    echo "  Current:  $STANDALONE_DIR"
    echo "  Rollback: $STANDALONE_OLD"
    echo ""

    read -p "Continue with rollback? (y/N): " confirm
    if [[ "$confirm" != "y" ]] && [[ "$confirm" != "Y" ]]; then
        echo "Cancelled"
        exit 0
    fi

    # Atomic swap: current → .failed, old → current
    STANDALONE_FAILED="$BUILDS_DIR/standalone.failed"
    rm -rf "$STANDALONE_FAILED"
    mv "$STANDALONE_DIR" "$STANDALONE_FAILED"
    mv "$STANDALONE_OLD" "$STANDALONE_DIR"
    log_success "Build swapped (failed build saved as standalone.failed)"
else
    log_error "No previous build found at $STANDALONE_OLD"
    log_error "The deployer-rs keeps one previous build as standalone.old."
    log_error "If this is the first deploy, there is nothing to rollback to."
    exit 1
fi

# Restart service
log_info "Restarting $SERVICE..."
if ! systemctl restart "$SERVICE"; then
    log_error "Failed to restart service"
    log_error "Check logs: journalctl -u $SERVICE -n 50"
    exit 1
fi

# Wait for service to be ready
log_info "Waiting for service to respond..."
WAITED=0
MAX_WAIT=30
while [[ $WAITED -lt $MAX_WAIT ]]; do
    if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then
        break
    fi
    sleep 1
    ((WAITED++))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
    log_warn "Service did not respond within ${MAX_WAIT}s"
    log_warn "Check logs: journalctl -u $SERVICE -n 50"
else
    log_success "Service responding after ${WAITED}s"
fi

echo ""
log_success "Rollback complete"
echo ""
systemctl status "$SERVICE" --no-pager | head -10
