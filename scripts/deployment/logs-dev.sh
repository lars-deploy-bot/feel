#!/bin/bash
set -e

# View dev environment logs
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/packages/shared/environments.json"

# Read dev process name from environments.json
DEV_PROCESS_NAME=$(jq -r '.environments.dev.processName' "$ENV_CONFIG")

pm2 logs "$DEV_PROCESS_NAME" --lines 1000
