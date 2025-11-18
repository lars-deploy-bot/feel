#!/bin/bash
set -e

# Staging deployment wrapper
# Runs full deployment: build → test → restart → health check
# Same as production but to staging environment (port 8998, .builds/staging/current)

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Starting staging deployment..."
"$PROJECT_ROOT/scripts/deployment/build-and-serve.sh" staging
