#!/bin/bash
# Link workspace dependencies to apps/web/node_modules
# This ensures Next.js/Turbopack can properly resolve workspace packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WEB_NM="$PROJECT_ROOT/apps/web/node_modules/@alive-brug"

echo "Linking workspace dependencies to apps/web/node_modules..."

# Create @alive-brug directory
mkdir -p "$WEB_NM"

# Link all workspace packages
for pkg in tools images template guides; do
    if [ -d "$PROJECT_ROOT/packages/$pkg" ]; then
        ln -sf "$PROJECT_ROOT/packages/$pkg" "$WEB_NM/$pkg"
        echo "✓ Linked @alive-brug/$pkg"
    fi
done

echo "✓ Workspace dependencies linked successfully"
