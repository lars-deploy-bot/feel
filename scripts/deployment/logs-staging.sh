#!/bin/bash
set -e

# View staging logs via systemd
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/environments.json"

STAGING_SERVICE=$(jq -r '.environments.staging.systemdService' "$ENV_CONFIG")
journalctl -u "$STAGING_SERVICE" -f
