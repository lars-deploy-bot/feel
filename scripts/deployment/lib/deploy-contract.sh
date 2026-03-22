#!/bin/bash
# =============================================================================
# Deploy Contract Constants (bash)
# =============================================================================
# GENERATED from the TypeScript deploy contract.
# Do NOT edit by hand — update deploy-contract.ts and regenerate.
#
# Usage: source this file in any bash script that touches deploy tables/APIs.
# =============================================================================

# -- Ports (from @webalive/shared PORTS) --
DEPLOY_PORT_API=5080
DEPLOY_PORT_DEPLOYER=5095
DEPLOY_PORT_STAGING=8998
DEPLOY_PORT_PRODUCTION=9000

# -- URLs --
DEPLOY_API_URL="http://127.0.0.1:${DEPLOY_PORT_API}"
DEPLOY_DEPLOYER_URL="http://127.0.0.1:${DEPLOY_PORT_DEPLOYER}"

# -- Deployer health endpoints --
DEPLOY_HEALTH_PATH="/health"
DEPLOY_HEALTH_DETAILS_PATH="/health/details"
DEPLOY_POKE_PATH="/poke"

# -- Task statuses (deploy.task_status enum) --
DEPLOY_STATUS_PENDING="pending"
DEPLOY_STATUS_RUNNING="running"
DEPLOY_STATUS_SUCCEEDED="succeeded"
DEPLOY_STATUS_FAILED="failed"
DEPLOY_STATUS_CANCELLED="cancelled"

# -- Environment names --
DEPLOY_ENV_STAGING="staging"
DEPLOY_ENV_PRODUCTION="production"

# -- Deployer worker statuses (health response) --
DEPLOYER_WORKER_IDLE="idle"
DEPLOYER_WORKER_BUILDING="building"
DEPLOYER_WORKER_DEPLOYING="deploying"
DEPLOYER_WORKER_ERROR="error"
DEPLOYER_WORKER_STARTING="starting"

# -- jq paths for health response (DeployerHealthResponse shape) --
DEPLOYER_JQ_OK='.ok'
DEPLOYER_JQ_WORKER_STATUS='.worker.status'
DEPLOYER_JQ_WORKER_BUILD_ID='.worker.current_build_id'
DEPLOYER_JQ_WORKER_DEPLOY_ID='.worker.current_deployment_id'
DEPLOYER_JQ_WORKER_LAST_ERROR='.worker.last_error'

# -- jq paths for health/details response --
DEPLOYER_JQ_CURRENT_STAGE='.current_deployment.current_stage'
