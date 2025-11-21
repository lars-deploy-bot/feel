#!/bin/bash
# Detect workspace issues that could break builds
# Run this before deployments to catch problems early

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_ROOT"

echo "🔍 Validating workspace integrity..."
ISSUES_FOUND=0

# Check 1: Circular symlinks in packages
echo ""
echo "[1/4] Checking for circular symlinks in packages..."
CIRCULAR_LINKS=$(find packages -maxdepth 2 -type l 2>/dev/null | while read link; do
    TARGET=$(readlink "$link")
    LINK_DIR=$(dirname "$link")
    LINK_NAME=$(basename "$link")
    PARENT_DIR=$(basename "$LINK_DIR")

    # Check if symlink points to its own parent directory
    if [[ "$TARGET" == *"/$PARENT_DIR" ]] || [[ "$TARGET" == *"/$PARENT_DIR/" ]]; then
        echo "  ❌ Circular: $link -> $TARGET"
        echo "$link"
    fi
done)

if [ -n "$CIRCULAR_LINKS" ]; then
    echo "❌ FAIL: Circular symlinks detected:"
    echo "$CIRCULAR_LINKS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo "✓ No circular symlinks found"
fi

# Check 2: Deprecated packages still present
echo ""
echo "[2/4] Checking for deprecated packages..."
DEPRECATED_PACKAGES=("deploy-scripts")
for pkg in "${DEPRECATED_PACKAGES[@]}"; do
    if [ -d "packages/$pkg" ]; then
        echo "  ❌ Deprecated package exists: packages/$pkg"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done
echo "✓ No deprecated packages found"

# Check 3: Broken symlinks in node_modules
echo ""
echo "[3/4] Checking for broken symlinks in node_modules..."
BROKEN_LINKS=$(find node_modules/@alive-brug node_modules/@webalive -maxdepth 1 -type l 2>/dev/null | while read link; do
    if [ ! -e "$link" ]; then
        echo "  ❌ Broken: $link"
        echo "$link"
    fi
done)

if [ -n "$BROKEN_LINKS" ]; then
    echo "❌ FAIL: Broken symlinks detected:"
    echo "$BROKEN_LINKS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo "✓ No broken symlinks in node_modules"
fi

# Check 4: Empty package directories
echo ""
echo "[4/4] Checking for empty package directories..."
for dir in packages/*/; do
    PKG_NAME=$(basename "$dir")
    if [ ! -f "$dir/package.json" ]; then
        echo "  ❌ No package.json in: packages/$PKG_NAME"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done
echo "✓ All packages have package.json"

echo ""
echo "═══════════════════════════════════════════"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo "✅ Workspace validation PASSED"
    exit 0
else
    echo "❌ Workspace validation FAILED: $ISSUES_FOUND issue(s) found"
    exit 1
fi
