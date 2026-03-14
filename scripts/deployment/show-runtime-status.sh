#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: show-runtime-status.sh <staging|production>}"

case "$ENVIRONMENT" in
  staging)
    PORT=8998
    SYSTEMD_UNIT="alive-staging"
    ;;
  production)
    PORT=9000
    SYSTEMD_UNIT="alive-production"
    ;;
  *)
    echo "Unsupported environment: $ENVIRONMENT" >&2
    exit 1
    ;;
esac

CONTAINER_NAME="alive-control-alive-$ENVIRONMENT"

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  CONTAINER_STATUS="$(docker inspect --format '{{.State.Status}}' "$CONTAINER_NAME")"
  HEALTH_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health" || true)"
  printf '  %s (%s):    \033[0;32mdocker:%s\033[0m (health %s)\n' "$ENVIRONMENT" "$PORT" "$CONTAINER_STATUS" "${HEALTH_STATUS:-n/a}"
  exit 0
fi

if systemctl is-active "$SYSTEMD_UNIT" >/dev/null 2>&1; then
  printf '  %s (%s):    \033[0;32msystemd:running\033[0m\n' "$ENVIRONMENT" "$PORT"
else
  printf '  %s (%s):    \033[0;31mstopped\033[0m\n' "$ENVIRONMENT" "$PORT"
fi
