#!/bin/bash
set -e

# ⚠️  WARNING: THIS FILE SHOULD NEVER BE RUN
# ⚠️  Production deployment is restricted - contact devops
# ⚠️  DO NOT execute this script unless explicitly authorized
#
# Production deployment wrapper
# Runs full deployment: build → test → restart → health check
#
# Usage:
#   make wash          # Full deployment with E2E tests
#   make wash-skip     # Skip E2E tests (faster, use for quick iterations)

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Starting production deployment..."

# Pass SKIP_E2E flag if set
if [ -n "$SKIP_E2E" ]; then
    echo "⚠️  Skipping E2E tests (SKIP_E2E=$SKIP_E2E)"
    SKIP_E2E="$SKIP_E2E" "$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" production
else
    "$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" production
fi
