.PHONY: help deploy-all-environments staging dev deploy-go logs-production logs-staging logs-dev status rollback wash wash-skip shell build\:shell test\:shell static-check

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
	@echo "  make deploy-all-environments  ⚠️  Run dev → staging → wash (requires CONFIRM_PROD=yes)"
	@echo "  make staging       Full staging deployment (port 8998)"
	@echo "  make dev           Rebuild and restart dev environment (port 8997, hot-reload)"
	@echo "  make dev:turbo     Run all monorepo dev servers with Turbo"
	@echo "  make deploy-go     Deploy shell-server-go separately (not included in staging/production)"
	@echo "  make shell         Run shell-server-go locally (port 3500)"
	@echo "  make build:shell   Build, test, and restart shell-server-go"
	@echo "  make test:shell    Run shell-server-go tests"
	@echo ""
	@echo "$(GREEN)Quality Checks:$(NC)"
	@echo "  make static-check  Run type-check, lint, format, and unit tests (used by pre-push hook)"
	@echo ""
	@echo "$(GREEN)Logs:$(NC)"
	@echo "  make logs-production     View production logs (systemd)"
	@echo "  make logs-staging  View staging logs (systemd)"
	@echo "  make logs-dev      View dev logs (systemd)"
	@echo ""
	@echo "$(GREEN)Troubleshooting:$(NC)"
	@echo "  make status        Show status of all environments"
	@echo "  make rollback      Interactive rollback to previous build"
	@echo ""
	@echo "$(RED)⚠️  Production deployment is intentionally hidden.$(NC)"
	@echo ""

# ⚠️  Full deployment pipeline: dev → staging → production
# Stops immediately on any failure and outputs full logs
# Each step must pass before proceeding to the next
#
# REQUIRES: CONFIRM_PROD=yes environment variable to proceed with production
# Usage: CONFIRM_PROD=yes make deploy-all-environments
deploy-all-environments:
	@echo "$(RED)⚠️  WARNING: This will deploy to dev → staging → production$(NC)"
	@echo ""
	@echo "$(BLUE)Step 1/3: Running dev deployment...$(NC)"
	@$(MAKE) dev || (echo "$(RED)✗ Dev deployment failed. Stopping.$(NC)" && exit 1)
	@echo ""
	@echo "$(GREEN)✓ Dev deployment passed$(NC)"
	@echo ""
	@echo "$(BLUE)Step 2/3: Running staging deployment...$(NC)"
	@$(MAKE) staging || (echo "$(RED)✗ Staging deployment failed. Stopping.$(NC)" && exit 1)
	@echo ""
	@echo "$(GREEN)✓ Staging deployment passed$(NC)"
	@echo ""
	@if [ "$(CONFIRM_PROD)" != "yes" ]; then \
		echo "$(RED)⚠️  Production deployment blocked!$(NC)"; \
		echo "$(RED)To deploy to production, run:$(NC)"; \
		echo "$(RED)  CONFIRM_PROD=yes make deploy-all-environments$(NC)"; \
		echo ""; \
		echo "$(GREEN)✓ Dev and staging deployed successfully. Production skipped.$(NC)"; \
		exit 0; \
	fi
	@echo "$(BLUE)Step 3/3: Running production deployment (wash)...$(NC)"
	@$(MAKE) wash || (echo "$(RED)✗ Production deployment failed. Stopping.$(NC)" && exit 1)
	@echo ""
	@echo "$(GREEN)✓✓✓ All deployments completed successfully! ✓✓✓$(NC)"

staging:
	@./scripts/deployment/deploy-staging.sh

dev:
	@./scripts/deployment/deploy-dev.sh

deploy-go:
	@./scripts/deployment/deploy-go-server.sh

logs-production:
	@./scripts/deployment/logs-production.sh

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

build\:shell:
	@echo "$(BLUE)Building shell-server-go...$(NC)"
	@cd apps/shell-server-go && make build
	@echo "$(GREEN)✓ Shell-server-go built successfully$(NC)"
	@echo "$(BLUE)Running tests...$(NC)"
	@cd apps/shell-server-go && make test
	@echo "$(GREEN)✓ All tests passed$(NC)"
	@echo "$(BLUE)Restarting shell-server-go service...$(NC)"
	@systemctl restart shell-server-go
	@sleep 1
	@echo "$(GREEN)✓ Service restarted$(NC)"
	@systemctl status shell-server-go --no-pager -l | head -8

test\:shell:
	@echo "$(BLUE)Running shell-server-go tests...$(NC)"
	@cd apps/shell-server-go && make test

static-check:
	@echo "$(BLUE)Running static checks (type-check, lint, format, unit tests)...$(NC)"
	@bun run static-check

# Never inspect
wash:
	@./scripts/deployment/washingmachine.sh

wash-skip:
	@SKIP_E2E=1 ./scripts/deployment/washingmachine.sh

.DEFAULT_GOAL := help

shell:
	@echo "$(GREEN)Starting shell-server-go locally...$(NC)"
	@echo "$(BLUE)Building shell-server-go...$(NC)"
	@cd apps/shell-server-go && make build
	@echo "$(GREEN)✓ Build complete$(NC)"
	@echo "$(BLUE)Running shell-server-go on http://localhost:3500$(NC)"
	@echo "$(BLUE)Password: devpassword$(NC)"
	@echo ""
	@cd apps/shell-server-go && PORT=3500 SHELL_PASSWORD=devpassword ./bin/shell-server
