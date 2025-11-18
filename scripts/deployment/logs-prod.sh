#!/bin/bash
set -e

# View production logs
source "$(dirname "$0")/env-helper.sh"

pm2 logs "$ENV_PROD_PROCESS_NAME" --lines 1000
