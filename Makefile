.PHONY: help staging dev logs-prod logs-staging logs-dev status rollback wash wash-skip shell

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
	@echo "  make shell         Run shell-server locally (port 3500)"
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

shell:
	@echo "$(GREEN)Starting shell-server locally...$(NC)"
	@if [ ! -f apps/shell-server/.env.local ]; then \
		echo "$(BLUE)Creating .env.local for local development...$(NC)"; \
		echo "PORT=3500" > apps/shell-server/.env.local; \
		echo "SHELL_PASSWORD=devpassword" >> apps/shell-server/.env.local; \
		echo "NODE_ENV=development" >> apps/shell-server/.env.local; \
		echo "$(GREEN)✓ Created .env.local$(NC)"; \
	fi
	@echo "$(BLUE)Building shell-server...$(NC)"
	@cd apps/shell-server && bun run build
	@echo "$(GREEN)✓ Build complete$(NC)"
	@echo "$(BLUE)Running shell-server on http://localhost:3500$(NC)"
	@echo "$(BLUE)Password: devpassword$(NC)"
	@echo "$(BLUE)Workspace: .alive/shell-server (auto-created)$(NC)"
	@echo ""
	@PORT=3500 SHELL_PASSWORD=devpassword NODE_ENV=development node apps/shell-server/dist/index.js
