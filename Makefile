# =============================================================================
# Alive Makefile
# =============================================================================
#
# Main commands:
#   make ship         - Full pipeline: staging → production
#   make staging      - Deploy staging only
#   make production   - Deploy production only
#   make dev          - Start dev server (hot-reload)
#
# =============================================================================

.PHONY: all clean test help ship ship-fast staging staging-fast production production-fast deploy-status smoke-deploy-entrypoint dev devchat static-check status logs-staging logs-production logs-dev rollback shell deploy-go preview-proxy services api manager deployer

all: help

clean:
	@echo "No clean target defined"

test:
	@bun run test:core

# Load environment variables
ifneq (,$(wildcard .env))
    include .env
    export
endif

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
RED := \033[0;31m
YELLOW := \033[1;33m
NC := \033[0m

# =============================================================================
# Help
# =============================================================================
help:
	@echo "$(BLUE)Alive$(NC)"
	@echo ""
	@echo "$(GREEN)Deployment:$(NC)"
	@echo "  make ship            🚀 Full pipeline: staging → production"
	@echo "  make ship-fast       Same as ship, skips E2E tests"
	@echo "  make staging         Deploy staging only (port 8998)"
	@echo "  make staging-fast    Deploy staging only, skip E2E tests"
	@echo "  make production      Deploy production only (port 9000)"
	@echo "  make production-fast Deploy production only, skip E2E tests"
	@echo "  make deploy-status   Check if a deployment is running"
	@echo "  make smoke-deploy-entrypoint Verify detached 'nohup make staging' startup path"
	@echo "  CLEAN_BUILD=1 ...    Force a full rebuild and clear deploy caches"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev             Start dev server (port 8997, hot-reload)"
	@echo "  make devchat         Restart dev server via systemctl"
	@echo "  make static-check    Run type-check, lint, format, unit tests"
	@echo ""
	@echo "$(GREEN)Logs & Status:$(NC)"
	@echo "  make status          Show all environments status"
	@echo "  make logs-staging    View staging logs"
	@echo "  make logs-production View production logs"
	@echo "  make logs-dev        View dev logs"
	@echo ""
	@echo "$(GREEN)Services:$(NC)"
	@echo "  make services        Build and deploy API + Manager"
	@echo "  make api             Build and deploy API only"
	@echo "  make manager         Build and deploy Manager only"
	@echo "  make deployer        Build and deploy the Rust deployer only"
	@echo ""
	@echo "$(GREEN)Other:$(NC)"
	@echo "  make rollback        Interactive rollback to previous build"
	@echo "  make shell           Build and deploy shell-server-go"
	@echo "  make preview-proxy   Build and deploy preview-proxy (Go)"
	@echo ""

.DEFAULT_GOAL := help

# =============================================================================
# Deployment - Main commands
# =============================================================================
# All deployments use a global lock - only one can run at a time.
# Use 'make deploy-status' to check if a deployment is running.

# Full pipeline: staging → production
ship:
	@./scripts/deployment/ship.sh

# Skip E2E tests (faster)
ship-fast:
	@./scripts/deployment/ship.sh --skip-e2e

# Staging only
staging:
	@./scripts/deployment/ship.sh --staging

# Staging only, skip E2E
staging-fast:
	@./scripts/deployment/ship.sh --staging --skip-e2e

# Production only
production:
	@./scripts/deployment/ship.sh --production

# Production only, skip E2E
production-fast:
	@./scripts/deployment/ship.sh --production --skip-e2e

# Check deployment lock status
deploy-status:
	@./scripts/deployment/ship.sh --status || true

smoke-deploy-entrypoint:
	@./scripts/deployment/smoke-detached-entrypoint.sh

# =============================================================================
# Development
# =============================================================================

# Start dev server with hot-reload
dev:
	@./scripts/deployment/deploy-dev.sh

# Restart dev server via systemctl (safe from chat)
devchat:
	@echo "$(BLUE)Restarting dev server...$(NC)"
	@systemctl restart alive-dev
	@sleep 2
	@echo "$(GREEN)✓ Dev server restarted$(NC)"
	@systemctl status alive-dev --no-pager | head -10

# Run all quality checks
static-check:
	@echo "$(BLUE)Running static checks...$(NC)"
	@bun install --frozen-lockfile
	@NODE_OPTIONS="--max-old-space-size=4096" bun run static-check

# =============================================================================
# Logs & Status
# =============================================================================

status:
	@echo "$(BLUE)Alive Status$(NC)"
	@echo ""
	@echo "$(GREEN)Services:$(NC)"
	@systemctl is-active alive-dev >/dev/null 2>&1 && echo "  Dev (8997):        $(GREEN)running$(NC)" || echo "  Dev (8997):        $(RED)stopped$(NC)"
	@./scripts/deployment/show-runtime-status.sh staging
	@./scripts/deployment/show-runtime-status.sh production
	@systemctl is-active preview-proxy >/dev/null 2>&1 && echo "  Preview proxy (5055): $(GREEN)running$(NC)" || echo "  Preview proxy (5055): $(RED)stopped$(NC)"
	@echo ""
	@echo "$(GREEN)Deployment Lock:$(NC)"
	@./scripts/deployment/ship.sh --status || true

logs-staging:
	@./scripts/deployment/follow-runtime-logs.sh staging

logs-production:
	@./scripts/deployment/follow-runtime-logs.sh production

logs-dev:
	@journalctl -u alive-dev -f

rollback:
	@./scripts/deployment/rollback.sh

# =============================================================================
# Shell Server (Go)
# =============================================================================

shell:
	@echo "$(BLUE)Building shell-server-go...$(NC)"
	@cd apps/shell-server-go && make build
	@echo "$(GREEN)✓ Build complete$(NC)"
	@echo "$(BLUE)Restarting service...$(NC)"
	@systemctl restart shell-server-go
	@sleep 2
	@echo "$(GREEN)✓ Service restarted$(NC)"
	@systemctl status shell-server-go --no-pager -l | head -10

deploy-go:
	@./scripts/deployment/deploy-go-server.sh

# =============================================================================
# Preview Proxy (Go)
# =============================================================================

preview-proxy:
	@./scripts/deployment/deploy-preview-proxy.sh

# =============================================================================
# Standalone Services (API + Manager)
# =============================================================================

services:
	@./scripts/deployment/deploy-services.sh

api:
	@./scripts/deployment/deploy-services.sh --api

manager:
	@./scripts/deployment/deploy-services.sh --manager

deployer:
	@./scripts/deployment/deploy-services.sh --deployer
