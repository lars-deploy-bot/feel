#!/bin/bash
# Link workspace dependencies to apps/web/node_modules
# This ensures Next.js/Turbopack can properly resolve workspace packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
WEB_NM="$PROJECT_ROOT/apps/web/node_modules"
ALIVE_BRUG_NM="$WEB_NM/@alive-brug"
WEBALIVE_NM="$WEB_NM/@webalive"

echo "Linking workspace dependencies to apps/web/node_modules..."

# Create @alive-brug directory
mkdir -p "$ALIVE_BRUG_NM"

# Link all @alive-brug packages
for pkg in tools images template guides; do
    if [ -d "$PROJECT_ROOT/packages/$pkg" ]; then
        ln -sf "$PROJECT_ROOT/packages/$pkg" "$ALIVE_BRUG_NM/$pkg"
        echo "✓ Linked @alive-brug/$pkg"
    fi
done

# Link deploy-scripts to @alive-brug
if [ -d "$PROJECT_ROOT/packages/deploy-scripts" ]; then
    ln -sf "$PROJECT_ROOT/packages/deploy-scripts" "$ALIVE_BRUG_NM/deploy-scripts"
    echo "✓ Linked @alive-brug/deploy-scripts"
fi

echo "✓ Workspace dependencies linked successfully"
