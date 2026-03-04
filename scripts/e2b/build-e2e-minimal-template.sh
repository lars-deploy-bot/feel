#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/templates/e2b/alive-e2e-minimal"
TEMPLATE_NAME="${E2B_E2E_TEMPLATE_NAME:-self-hosted/alive-e2e-minimal}"
START_CMD="${E2B_E2E_TEMPLATE_START_CMD:-sleep infinity}"
READY_CMD="${E2B_E2E_TEMPLATE_READY_CMD:-test -d /home/user/project}"

echo "Building E2B minimal template:"
echo "  name:  $TEMPLATE_NAME"
echo "  path:  $TEMPLATE_DIR"
echo "  start: $START_CMD"
echo "  ready: $READY_CMD"

cd "$ROOT_DIR"
bunx @e2b/cli template build \
  --path "$TEMPLATE_DIR" \
  --dockerfile e2b.Dockerfile \
  --name "$TEMPLATE_NAME" \
  --cmd "$START_CMD" \
  --ready-cmd "$READY_CMD" \
  "$@"
