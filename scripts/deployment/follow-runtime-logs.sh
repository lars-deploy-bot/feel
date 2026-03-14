#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: follow-runtime-logs.sh <staging|production>}"

case "$ENVIRONMENT" in
  staging)
    SYSTEMD_UNIT="alive-staging"
    ;;
  production)
    SYSTEMD_UNIT="alive-production"
    ;;
  *)
    echo "Unsupported environment: $ENVIRONMENT" >&2
    exit 1
    ;;
esac

CONTAINER_NAME="alive-control-alive-$ENVIRONMENT"

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  exec docker logs -f "$CONTAINER_NAME"
fi

exec journalctl -u "$SYSTEMD_UNIT" -f
