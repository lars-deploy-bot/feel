#!/bin/bash
set -e

# Production deployment wrapper
# Runs full deployment: build → test → restart → health check

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Starting production deployment..."
"$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" prod
