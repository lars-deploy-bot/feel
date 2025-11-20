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

# Create @webalive directory and link site-controller
mkdir -p "$WEBALIVE_NM"
if [ -d "$PROJECT_ROOT/packages/site-controller" ]; then
    ln -sf "$PROJECT_ROOT/packages/site-controller" "$WEBALIVE_NM/site-controller"
    echo "✓ Linked @webalive/site-controller"
fi

echo "✓ Workspace dependencies linked successfully"
