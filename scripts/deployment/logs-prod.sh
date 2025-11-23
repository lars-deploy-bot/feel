#!/bin/bash
set -e

# View production logs via systemd
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/packages/shared/environments.json"

PROD_SERVICE=$(jq -r '.environments.production.systemdService' "$ENV_CONFIG")
journalctl -u "$PROD_SERVICE" -f
