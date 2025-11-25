#!/bin/bash
# Quick type-check before committing
# Uses turbo cache for speed - typically <200ms when cached

set -e

# Get repo root (works regardless of where script is called from)
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Check if any TypeScript files are staged
CHANGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -z "$CHANGED_TS_FILES" ]; then
    echo "✅ No TypeScript files staged - skipping type-check"
    exit 0
fi

echo "🔍 Running type-check (turbo cached)..."

# Quick type check using turbo (handles monorepo correctly, uses cache)
if ! bunx turbo run type-check --filter='./apps/*' --filter='./packages/*'; then
    echo ""
    echo "❌ Type errors found! Fix them before committing."
    echo "Run 'bun run type-check' to see all errors"
    exit 1
fi

echo "✅ Type check passed!"
