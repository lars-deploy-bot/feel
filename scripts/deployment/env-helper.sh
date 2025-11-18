#!/bin/bash
# Environment Configuration Helper
# Source this file in bash scripts to access environment values
#
# READS FROM: environments.json (single source of truth)
#
# Usage:
#   source ./scripts/env-helper.sh
#   echo "Dev port: ${ENV_DEV_PORT}"
#   echo "Prod process: ${ENV_PROD_PROCESS_NAME}"

set -e

# Get the root directory (parent of scripts/deployment)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
ENV_CONFIG_FILE="$ROOT_DIR/environments.json"

if [ ! -f "$ENV_CONFIG_FILE" ]; then
  echo "ERROR: environments.json not found at $ENV_CONFIG_FILE" >&2
  exit 1
fi

# Helper to extract JSON value
function get_json_value() {
  local file="$1"
  local key="$2"
  node -e "const cfg = require('$file'); console.log(cfg.$key)"
}

# Load all environment values from environments.json
export ENV_PROD_KEY="production"
export ENV_PROD_NAME=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.displayName")
export ENV_PROD_PREFIX=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.prefix")
export ENV_PROD_PORT=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.port")
export ENV_PROD_DOMAIN=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.domain")
export ENV_PROD_PROCESS_NAME=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.processName")
export ENV_PROD_SERVER_SCRIPT=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.serverScript")
export ENV_PROD_WORKSPACE_PATH=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.workspacePath")
export ENV_PROD_DEPLOY_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.deployCommand")
export ENV_PROD_LOGS_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.logsCommand")
export ENV_PROD_RESTART_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.production.restartCommand")

export ENV_STAGING_KEY="staging"
export ENV_STAGING_NAME=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.displayName")
export ENV_STAGING_PREFIX=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.prefix")
export ENV_STAGING_PORT=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.port")
export ENV_STAGING_DOMAIN=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.domain")
export ENV_STAGING_PROCESS_NAME=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.processName")
export ENV_STAGING_SERVER_SCRIPT=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.serverScript")
export ENV_STAGING_WORKSPACE_PATH=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.workspacePath")
export ENV_STAGING_DEPLOY_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.deployCommand")
export ENV_STAGING_LOGS_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.logsCommand")
export ENV_STAGING_RESTART_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.staging.restartCommand")

export ENV_DEV_KEY="dev"
export ENV_DEV_NAME=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.displayName")
export ENV_DEV_PREFIX=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.prefix")
export ENV_DEV_PORT=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.port")
export ENV_DEV_DOMAIN=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.domain")
export ENV_DEV_PROCESS_NAME=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.processName")
export ENV_DEV_SERVER_SCRIPT=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.serverScript")
export ENV_DEV_WORKSPACE_PATH=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.workspacePath")
export ENV_DEV_DEPLOY_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.deployCommand")
export ENV_DEV_LOGS_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.logsCommand")
export ENV_DEV_RESTART_CMD=$(get_json_value "$ENV_CONFIG_FILE" "environments.dev.restartCommand")

# Validation
if [ "$ENV_PROD_PORT" = "$ENV_STAGING_PORT" ] || [ "$ENV_PROD_PORT" = "$ENV_DEV_PORT" ] || [ "$ENV_STAGING_PORT" = "$ENV_DEV_PORT" ]; then
  echo "ERROR: Production, staging, and dev ports must all be different" >&2
  exit 1
fi

if [ "$ENV_PROD_PROCESS_NAME" = "$ENV_STAGING_PROCESS_NAME" ] || [ "$ENV_PROD_PROCESS_NAME" = "$ENV_DEV_PROCESS_NAME" ] || [ "$ENV_STAGING_PROCESS_NAME" = "$ENV_DEV_PROCESS_NAME" ]; then
  echo "ERROR: Production, staging, and dev process names must all be different" >&2
  exit 1
fi

# Helper functions
function get_env_port() {
  local env_key=$1
  eval "echo \${ENV_${env_key^^}_PORT}"
}

function get_env_process() {
  local env_key=$1
  eval "echo \${ENV_${env_key^^}_PROCESS_NAME}"
}

function get_env_domain() {
  local env_key=$1
  eval "echo \${ENV_${env_key^^}_DOMAIN}"
}

function get_env_logs_cmd() {
  local env_key=$1
  eval "echo \${ENV_${env_key^^}_LOGS_CMD}"
}

function get_env_restart_cmd() {
  local env_key=$1
  eval "echo \${ENV_${env_key^^}_RESTART_CMD}"
}
