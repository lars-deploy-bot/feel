#!/bin/bash
# =============================================================================
# SHIP - Unified deployment script for Claude Bridge
# =============================================================================
#
# Usage:
#   ./ship.sh                    # Deploy staging → production (full pipeline)
#   ./ship.sh --staging          # Deploy staging only
#   ./ship.sh --production       # Deploy production only
#   ./ship.sh --skip-e2e         # Skip E2E tests (faster)
#   ./ship.sh --background       # Run in background with smart polling
#
# Examples:
#   ./ship.sh                    # Full pipeline: staging then production
#   ./ship.sh --staging          # Just staging
#   ./ship.sh --skip-e2e         # Full pipeline without E2E tests
#   ./ship.sh --background       # Run detached (for chat sessions)
#
# Exit codes:
#   0 - Success
#   1 - Deployment failed
#   2 - Timeout (background mode only)
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# Defaults
DEPLOY_STAGING=true
DEPLOY_PRODUCTION=true
SKIP_E2E=false
BACKGROUND=false
LOG_FILE="/tmp/ship-deploy.log"
MAX_WAIT_MINUTES=15

# =============================================================================
# Parse arguments
# =============================================================================
while [[ $# -gt 0 ]]; do
    case $1 in
        --staging)
            DEPLOY_STAGING=true
            DEPLOY_PRODUCTION=false
            shift
            ;;
        --production)
            DEPLOY_STAGING=false
            DEPLOY_PRODUCTION=true
            shift
            ;;
        --skip-e2e)
            SKIP_E2E=true
            shift
            ;;
        --background)
            BACKGROUND=true
            shift
            ;;
        --help|-h)
            head -35 "$0" | tail -30
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage"
            exit 1
            ;;
    esac
done

# =============================================================================
# Background mode: fork and monitor
# =============================================================================
if [ "$BACKGROUND" = true ]; then
    echo -e "${BLUE}Starting deployment in background...${NC}"

    # Build the command to run
    CMD="$0"
    [ "$SKIP_E2E" = true ] && CMD="$CMD --skip-e2e"
    [ "$DEPLOY_STAGING" = true ] && [ "$DEPLOY_PRODUCTION" = false ] && CMD="$CMD --staging"
    [ "$DEPLOY_STAGING" = false ] && [ "$DEPLOY_PRODUCTION" = true ] && CMD="$CMD --production"

    # Start in background
    nohup $CMD > "$LOG_FILE" 2>&1 &
    BG_PID=$!
    echo "PID: $BG_PID"
    echo "Log: $LOG_FILE"
    echo ""

    # Smart polling loop
    start_time=$(date +%s)
    max_seconds=$((MAX_WAIT_MINUTES * 60))

    while true; do
        elapsed=$(($(date +%s) - start_time))

        # Timeout check
        if [ $elapsed -gt $max_seconds ]; then
            echo -e "\n${RED}Timeout after ${MAX_WAIT_MINUTES} minutes${NC}"
            exit 2
        fi

        # Check if process finished
        if ! ps -p $BG_PID > /dev/null 2>&1; then
            echo ""
            if grep -q "SHIP COMPLETE\|deployed successfully" "$LOG_FILE" 2>/dev/null; then
                echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
                # Show summary
                grep -E "Environment:|Port:|Build:|Total time:" "$LOG_FILE" | tail -8
                exit 0
            else
                echo -e "${RED}✗ Deployment failed${NC}"
                tail -30 "$LOG_FILE"
                exit 1
            fi
        fi

        # Show progress
        current_phase=$(grep -oE '\[[0-9]/8\].*' "$LOG_FILE" 2>/dev/null | tail -1 | cut -c1-60 || echo "starting...")
        elapsed_min=$((elapsed / 60))
        elapsed_sec=$((elapsed % 60))
        printf "\r[%02d:%02d] %-60s" $elapsed_min $elapsed_sec "$current_phase"

        # Smart sleep: faster at start, slower later
        if [ $elapsed -lt 120 ]; then
            sleep 5
        elif [ $elapsed -lt 300 ]; then
            sleep 15
        else
            sleep 30
        fi
    done
fi

# =============================================================================
# Main deployment logic
# =============================================================================
cd "$PROJECT_ROOT"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}${BOLD}🚀 SHIP: Claude Bridge Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Show what we're deploying
if [ "$DEPLOY_STAGING" = true ] && [ "$DEPLOY_PRODUCTION" = true ]; then
    echo -e "Pipeline: ${BOLD}staging → production${NC}"
elif [ "$DEPLOY_STAGING" = true ]; then
    echo -e "Target: ${BOLD}staging only${NC}"
else
    echo -e "Target: ${BOLD}production only${NC}"
fi
[ "$SKIP_E2E" = true ] && echo -e "${YELLOW}⚠️  Skipping E2E tests${NC}"
echo ""

# Track overall timing
SHIP_START=$(date +%s)

# -----------------------------------------------------------------------------
# Deploy staging
# -----------------------------------------------------------------------------
if [ "$DEPLOY_STAGING" = true ]; then
    echo -e "${BLUE}[STAGING] Starting deployment...${NC}"

    if [ "$SKIP_E2E" = true ]; then
        SKIP_E2E=1 "$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" staging
    else
        "$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" staging
    fi

    echo -e "${GREEN}[STAGING] ✓ Deployed successfully${NC}"
    echo ""
fi

# -----------------------------------------------------------------------------
# Deploy production
# -----------------------------------------------------------------------------
if [ "$DEPLOY_PRODUCTION" = true ]; then
    echo -e "${BLUE}[PRODUCTION] Starting deployment...${NC}"

    if [ "$SKIP_E2E" = true ]; then
        SKIP_E2E=1 "$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" production
    else
        "$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" production
    fi

    echo -e "${GREEN}[PRODUCTION] ✓ Deployed successfully${NC}"
    echo ""
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
SHIP_END=$(date +%s)
TOTAL_TIME=$((SHIP_END - SHIP_START))
TOTAL_MIN=$((TOTAL_TIME / 60))
TOTAL_SEC=$((TOTAL_TIME % 60))

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}✓✓✓ SHIP COMPLETE ✓✓✓${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total time: ${BOLD}${TOTAL_MIN}m ${TOTAL_SEC}s${NC}"
echo ""

# Quick health check
echo -e "${BOLD}Health check:${NC}"
[ "$DEPLOY_STAGING" = true ] && (curl -sf http://localhost:8998/ > /dev/null && echo "  Staging (8998): ✓" || echo "  Staging (8998): ✗")
[ "$DEPLOY_PRODUCTION" = true ] && (curl -sf http://localhost:9000/ > /dev/null && echo "  Production (9000): ✓" || echo "  Production (9000): ✗")
echo ""
