#!/bin/bash
# Deploy shell-server-go independently
# Usage: ./deploy-go-server.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_step() { echo -e "${GREEN}[GO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GO_SERVER_DIR="$PROJECT_ROOT/apps/shell-server-go"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Deploying shell-server-go"
echo "═══════════════════════════════════════════════════════"
echo ""

# Verify directory exists
if [ ! -d "$GO_SERVER_DIR" ]; then
    log_error "Go server directory not found: $GO_SERVER_DIR"
    exit 1
fi

cd "$GO_SERVER_DIR"

# Build
log_step "Building shell-server-go..."
if make build 2>&1; then
    log_success "Build successful"
else
    log_error "Build failed"
    exit 1
fi

# Restart service
if systemctl is-active --quiet shell-server-go; then
    log_step "Restarting shell-server-go systemd service..."
    systemctl restart shell-server-go
    sleep 2
    if systemctl is-active --quiet shell-server-go; then
        log_success "shell-server-go restarted successfully"
    else
        log_error "shell-server-go failed to start"
        log_step "Check logs: journalctl -u shell-server-go -n 50"
        exit 1
    fi
else
    log_step "Starting shell-server-go systemd service..."
    systemctl start shell-server-go
    sleep 2
    if systemctl is-active --quiet shell-server-go; then
        log_success "shell-server-go started successfully"
    else
        log_error "shell-server-go failed to start"
        log_step "Check logs: journalctl -u shell-server-go -n 50"
        exit 1
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════"
log_success "shell-server-go deployed successfully"
echo "  📡 Status:  systemctl status shell-server-go"
echo "  📜 Logs:    journalctl -u shell-server-go -f"
echo "═══════════════════════════════════════════════════════"
