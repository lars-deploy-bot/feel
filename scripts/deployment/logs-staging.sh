#!/bin/bash
set -e

# View staging logs
source "$(dirname "$0")/env-helper.sh"

pm2 logs "$ENV_STAGING_PROCESS_NAME" --lines 1000
