#!/bin/bash
# =============================================================================
# SHIP - Alive Deployment Pipeline
# =============================================================================
#
# Usage:
#   ./ship.sh                    # Deploy staging → production
#   ./ship.sh --staging          # Deploy staging only
#   ./ship.sh --production       # Deploy production only
#   ./ship.sh --skip-e2e         # Skip E2E tests (faster)
#
# The pipeline ensures only one deployment runs at a time across all
# environments. Dev is handled separately (see deploy-dev.sh).
#
# Exit codes:
#   0 - Success
#   1 - Deployment failed or blocked
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Load libraries
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/lock.sh"

# =============================================================================
# Configuration
# =============================================================================
DEPLOY_STAGING=true
DEPLOY_PRODUCTION=true
SKIP_E2E=false
DEPLOYER_HEALTH_URL="http://127.0.0.1:5095/health"

deployer_busy_summary() {
    local health_json build_id deployment_id

    health_json=$(curl -sf "$DEPLOYER_HEALTH_URL" 2>/dev/null || true)
    if [[ -z "$health_json" ]]; then
        return 1
    fi

    build_id=$(printf '%s' "$health_json" | jq -r '.worker.current_build_id // empty' 2>/dev/null || true)
    deployment_id=$(printf '%s' "$health_json" | jq -r '.worker.current_deployment_id // empty' 2>/dev/null || true)

    if [[ -n "$build_id" || -n "$deployment_id" ]]; then
        printf 'deployer busy (build=%s deployment=%s)\n' "$build_id" "$deployment_id"
        return 0
    fi

    return 1
}

# =============================================================================
# Parse Arguments
# =============================================================================
while [[ $# -gt 0 ]]; do
    case $1 in
        --staging|-s)
            DEPLOY_STAGING=true
            DEPLOY_PRODUCTION=false
            shift
            ;;
        --production|-p)
            DEPLOY_STAGING=false
            DEPLOY_PRODUCTION=true
            shift
            ;;
        --skip-e2e)
            SKIP_E2E=true
            shift
            ;;
        --status)
            lock_status
            exit $?
            ;;
        --help|-h)
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage"
            exit 1
            ;;
    esac
done

# =============================================================================
# Determine Target
# =============================================================================
if [ "$DEPLOY_STAGING" = true ] && [ "$DEPLOY_PRODUCTION" = true ]; then
    TARGET="staging+production"
    TARGET_DISPLAY="staging → production"
elif [ "$DEPLOY_STAGING" = true ]; then
    TARGET="staging"
    TARGET_DISPLAY="staging"
else
    TARGET="production"
    TARGET_DISPLAY="production"
fi

if deployer_summary=$(deployer_busy_summary); then
    log_error "$deployer_summary"
    exit 1
fi

# =============================================================================
# Acquire Lock (includes orphan cleanup if stale lock detected)
# =============================================================================
if ! lock_acquire "$TARGET"; then
    exit 1
fi

SMOKE_HOLD_SECONDS="${ALIVE_DEPLOY_SMOKE_HOLD_LOCK_SECONDS:-0}"
if [[ "$SMOKE_HOLD_SECONDS" != "0" ]]; then
    if ! [[ "$SMOKE_HOLD_SECONDS" =~ ^[0-9]+$ ]]; then
        log_error "ALIVE_DEPLOY_SMOKE_HOLD_LOCK_SECONDS must be an integer"
        exit 1
    fi
    lock_update_phase "smoke-hold"
    log_info "Smoke mode: holding deploy lock for ${SMOKE_HOLD_SECONDS}s without starting a deployment"
    sleep "$SMOKE_HOLD_SECONDS"
    log_success "Smoke mode complete"
    exit 0
fi

# =============================================================================
# Main Pipeline
# =============================================================================
cd "$PROJECT_ROOT"
timer_start

banner "🚀 SHIP: Alive Deployment"

echo -e "Target: ${BOLD}$TARGET_DISPLAY${NC}"
if [ "$SKIP_E2E" = true ]; then
    echo -e "${YELLOW}⚠️  Skipping E2E tests${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# Deploy Staging
# -----------------------------------------------------------------------------
if [ "$DEPLOY_STAGING" = true ]; then
    log_info "Deploying to staging..."
    lock_update_phase "staging"

    if [ "$SKIP_E2E" = true ]; then
        SKIP_E2E=1 "$SCRIPT_DIR/deploy-via-deployer.sh" staging
    else
        "$SCRIPT_DIR/deploy-via-deployer.sh" staging
    fi

    log_success "Staging deployed"
    echo ""
fi

# -----------------------------------------------------------------------------
# Deploy Production
# -----------------------------------------------------------------------------
if [ "$DEPLOY_PRODUCTION" = true ]; then
    log_info "Deploying to production..."
    lock_update_phase "production"

    if [ "$DEPLOY_STAGING" = true ]; then
        # Staging already validated: promote its build, skip checks and E2E
        PROMOTE_FROM=staging SKIP_E2E=1 \
            "$SCRIPT_DIR/build-and-serve.sh" production
    else
        # Production-only deploy: always skip E2E (E2E runs against staging, not production)
        SKIP_E2E=1 "$SCRIPT_DIR/build-and-serve.sh" production
    fi

    log_success "Production deployed"
    echo ""
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
lock_update_phase "complete"
TOTAL_TIME=$(timer_elapsed)

banner_success "✓ SHIP COMPLETE"

echo -e "Total time: ${BOLD}$(format_duration $TOTAL_TIME)${NC}"
echo ""

echo -e "${BOLD}Health check:${NC}"
if [ "$DEPLOY_STAGING" = true ]; then
    if health_check "http://localhost:8998/" 1 1; then
        echo -e "  Staging (8998):    ${GREEN}✓${NC}"
    else
        echo -e "  Staging (8998):    ${RED}✗${NC}"
    fi
fi
if [ "$DEPLOY_PRODUCTION" = true ]; then
    if health_check "http://localhost:9000/" 1 1; then
        echo -e "  Production (9000): ${GREEN}✓${NC}"
    else
        echo -e "  Production (9000): ${RED}✗${NC}"
    fi
fi
echo ""
