#!/bin/bash
# =============================================================================
# Deploy standalone services (API + Manager)
# =============================================================================
# Builds and restarts the API (Hono), Manager (Vite + Bun), and the Rust deployer.
# Fails fast if not on main branch.
#
# Usage:
#   ./deploy-services.sh              # Deploy all
#   ./deploy-services.sh --api        # API only
#   ./deploy-services.sh --manager    # Manager only
#   ./deploy-services.sh --deployer   # Deployer only
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

source "$SCRIPT_DIR/lib/common.sh"

# =============================================================================
# Parse Arguments
# =============================================================================
DEPLOY_API=true
DEPLOY_MANAGER=true
DEPLOY_DEPLOYER=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --api)
            DEPLOY_API=true
            DEPLOY_MANAGER=false
            DEPLOY_DEPLOYER=false
            shift
            ;;
        --manager)
            DEPLOY_API=false
            DEPLOY_MANAGER=true
            DEPLOY_DEPLOYER=false
            shift
            ;;
        --deployer)
            DEPLOY_API=false
            DEPLOY_MANAGER=false
            DEPLOY_DEPLOYER=true
            shift
            ;;
        --help|-h)
            head -12 "$0" | tail -8
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# =============================================================================
# Guards
# =============================================================================
require_branch "main"

# =============================================================================
# Deploy API
# =============================================================================
if [ "$DEPLOY_API" = true ]; then
    banner "Deploying API (Hono)"

    log_info "Building @webalive/api..."
    if ! bun run --filter='@webalive/api' build 2>&1; then
        log_error "API build failed"
        exit 1
    fi
    log_success "API built"

    log_info "Restarting alive-api..."
    systemctl daemon-reload
    systemctl enable --now alive-api
    sleep 1

    if systemctl is-active --quiet alive-api; then
        log_success "alive-api running on port 5080"
    else
        log_error "alive-api failed to start"
        log_step "Check logs: journalctl -u alive-api -n 50"
        exit 1
    fi
fi

# =============================================================================
# Deploy Manager
# =============================================================================
if [ "$DEPLOY_MANAGER" = true ]; then
    banner "Deploying Manager (Vite + Bun)"

    log_info "Building @webalive/manager..."
    if ! bun run --filter='@webalive/manager' build 2>&1; then
        log_error "Manager build failed"
        exit 1
    fi
    log_success "Manager built"

    log_info "Restarting alive-manager..."
    systemctl restart alive-manager
    sleep 1

    if systemctl is-active --quiet alive-manager; then
        log_success "alive-manager running on port 5090"
    else
        log_error "alive-manager failed to start"
        log_step "Check logs: journalctl -u alive-manager -n 50"
        exit 1
    fi
fi

# =============================================================================
# Deploy Deployer
# =============================================================================
if [ "$DEPLOY_DEPLOYER" = true ]; then
    banner "Deploying Alive Deployer (Rust + Docker)"

    log_info "Syncing repo-managed systemd units..."
    "$PROJECT_ROOT/scripts/systemd/sync-ops-units.sh" --alive-root "$PROJECT_ROOT"
    log_success "Systemd units synced"

    log_info "Building alive-deployer-rs..."
    if ! cargo build --release --manifest-path "$PROJECT_ROOT/apps/deployer-rs/Cargo.toml" 2>&1; then
        log_error "Deployer build failed"
        exit 1
    fi
    log_success "Deployer built"

    log_info "Restarting alive-deployer..."
    systemctl daemon-reload
    systemctl enable --now alive-deployer
    sleep 1

    if systemctl is-active --quiet alive-deployer; then
        log_success "alive-deployer running on localhost:5095"
    else
        log_error "alive-deployer failed to start"
        log_step "Check logs: journalctl -u alive-deployer -n 50"
        exit 1
    fi
fi

# =============================================================================
# Done
# =============================================================================
banner_success "Services deployed"
if [ "$DEPLOY_API" = true ]; then
    echo -e "  API:     ${GREEN}alive-api${NC} (port 5080)"
fi
if [ "$DEPLOY_MANAGER" = true ]; then
    echo -e "  Manager: ${GREEN}alive-manager${NC} (port 5090)"
fi
if [ "$DEPLOY_DEPLOYER" = true ]; then
    echo -e "  Deployer: ${GREEN}alive-deployer${NC} (localhost:5095)"
fi
echo ""
