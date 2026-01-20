# =============================================================================
# Claude Bridge Makefile
# =============================================================================
#
# Main commands:
#   make ship         - Full pipeline: staging → production
#   make staging      - Deploy staging only
#   make production   - Deploy production only
#   make dev          - Start dev server (hot-reload)
#
# =============================================================================

.PHONY: help ship staging production dev devchat static-check status logs-staging logs-production logs-dev rollback shell deploy-go

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
	@echo "$(BLUE)Claude Bridge$(NC)"
	@echo ""
	@echo "$(GREEN)Deployment:$(NC)"
	@echo "  make ship            🚀 Full pipeline: staging → production"
	@echo "  make ship-bg         Same as ship, runs in background (for chat)"
	@echo "  make ship-fast       Same as ship, skips E2E tests"
	@echo "  make staging         Deploy staging only (port 8998)"
	@echo "  make production      Deploy production only (port 9000)"
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
	@echo "$(GREEN)Other:$(NC)"
	@echo "  make rollback        Interactive rollback to previous build"
	@echo "  make shell           Build and deploy shell-server-go"
	@echo ""

.DEFAULT_GOAL := help

# =============================================================================
# Deployment - Main commands
# =============================================================================

# Full pipeline: staging → production
ship:
	@./scripts/deployment/ship.sh

# Background mode with smart polling (for chat sessions)
ship-bg:
	@./scripts/deployment/ship.sh --background

# Skip E2E tests (faster)
ship-fast:
	@./scripts/deployment/ship.sh --skip-e2e

# Staging only
staging:
	@./scripts/deployment/ship.sh --staging

# Production only
production:
	@./scripts/deployment/ship.sh --production

# =============================================================================
# Development
# =============================================================================

# Start dev server with hot-reload
dev:
	@./scripts/deployment/deploy-dev.sh

# Restart dev server via systemctl (safe from chat)
devchat:
	@echo "$(BLUE)Restarting dev server...$(NC)"
	@systemctl restart claude-bridge-dev
	@sleep 2
	@echo "$(GREEN)✓ Dev server restarted$(NC)"
	@systemctl status claude-bridge-dev --no-pager | head -10

# Run all quality checks
static-check:
	@echo "$(BLUE)Running static checks...$(NC)"
	@NODE_OPTIONS="--max-old-space-size=4096" bun run static-check

# =============================================================================
# Logs & Status
# =============================================================================

status:
	@./scripts/deployment/status.sh

logs-staging:
	@journalctl -u claude-bridge-staging -f

logs-production:
	@journalctl -u claude-bridge-production -f

logs-dev:
	@journalctl -u claude-bridge-dev -f

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
