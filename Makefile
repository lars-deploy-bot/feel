.PHONY: help staging dev logs-prod logs-staging logs-dev status rollback wash wash-skip

# Load environment variables from .env
ifneq (,$(wildcard .env))
    include .env
    export
endif

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
RED := \033[0;31m
NC := \033[0m # No Color

help:
	@echo "$(BLUE)Claude Bridge Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Development & Staging:$(NC)"
	@echo "  make staging       Full staging deployment (port 8998)"
	@echo "  make dev           Rebuild and restart dev environment (port 8997, hot-reload)"
	@echo "  make dev:turbo     Run all monorepo dev servers with Turbo"
	@echo ""
	@echo "$(GREEN)Logs:$(NC)"
	@echo "  make logs-prod     View production logs (systemd)"
	@echo "  make logs-staging  View staging logs (systemd)"
	@echo "  make logs-dev      View dev logs (PM2)"
	@echo ""
	@echo "$(GREEN)Troubleshooting:$(NC)"
	@echo "  make status        Show status of all environments"
	@echo "  make rollback      Interactive rollback to previous build"
	@echo ""
	@echo "$(RED)⚠️  Production deployment is intentionally hidden.$(NC)"
	@echo "$(RED)Contact devops for production deploys.$(NC)"
	@echo ""

staging:
	@./scripts/deployment/deploy-staging.sh

dev:
	@./scripts/deployment/deploy-dev.sh

logs-prod:
	@./scripts/deployment/logs-prod.sh

logs-staging:
	@./scripts/deployment/logs-staging.sh

logs-dev:
	@./scripts/deployment/logs-dev.sh

status:
	@./scripts/deployment/status.sh

rollback:
	@./scripts/deployment/rollback.sh

dev\:turbo:
	@bun run dev:turbo

# Never inspect
wash:
	@./scripts/deployment/washingmachine.sh

wash-skip:
	@SKIP_E2E=1 ./scripts/deployment/washingmachine.sh

.DEFAULT_GOAL := help
