#!/bin/bash
set -e

# View dev environment logs
source "$(dirname "$0")/env-helper.sh"

pm2 logs "$ENV_DEV_PROCESS_NAME" --lines 1000
