#!/bin/bash
# Block new type assertions in test files.
#
# Enforces the work from issue #142: type assertions (`as X`) make tests
# brittle by hiding shape mismatches. This gate prevents regressions.
#
# Allowed exceptions (grep -v filters):
#   - `as const`           — legitimate literal-type narrowing
#   - `as unknown as`      — existing Supabase partial mocks (tracked, being eliminated)
#   - `@ts-expect-error`   — intentional runtime-guard testing with invalid types
#   - `import * as`        — namespace imports, not type assertions
#   - `import type.*as`    — type-only namespace imports
#   - comment lines        — `// ... as ...` in descriptions/comments

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "Checking type assertions in test files..."

# Current budget: the number we shipped with.
# Ratchet this DOWN as files are cleaned up — never UP.
MAX_AS_TYPE=5         # non-const, non-unknown `as Type` assertions
MAX_AS_ANY=0          # `as any` — zero tolerance
MAX_AS_UNKNOWN=17     # `as unknown as Type` — Supabase partial mocks (to be eliminated)

# --- Counters ---------------------------------------------------------------

count_as_type() {
  { grep -rn ' as [A-Z]' \
    --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' \
    apps/ packages/ \
    | grep -v 'node_modules' | grep -v '.next/' \
    | grep -v ' as const' \
    | grep -v ' as unknown' \
    | grep -v 'import \* as' \
    | grep -v 'import type.*as' \
    | grep -v '^\s*//' \
    | grep -v ' \* .*as [A-Z]' \
    | grep -v '".*as [A-Z].*"' \
    | grep -v "'.*as [A-Z].*'" \
    | grep -v '\`.*as [A-Z].*\`' \
    || true; } | wc -l | tr -d ' '
}

count_as_any() {
  { grep -rn ' as any' \
    --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' \
    apps/ packages/ \
    | grep -v 'node_modules' | grep -v '.next/' \
    || true; } | wc -l | tr -d ' '
}

count_as_unknown() {
  { grep -rn ' as unknown' \
    --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' \
    apps/ packages/ \
    | grep -v 'node_modules' | grep -v '.next/' \
    || true; } | wc -l | tr -d ' '
}

# --- Run checks -------------------------------------------------------------

ACTUAL_AS_TYPE=$(count_as_type)
ACTUAL_AS_ANY=$(count_as_any)
ACTUAL_AS_UNKNOWN=$(count_as_unknown)
FAILED=0

if [ "$ACTUAL_AS_ANY" -gt "$MAX_AS_ANY" ]; then
  echo "FAIL: Found $ACTUAL_AS_ANY 'as any' assertions in tests (max: $MAX_AS_ANY)" >&2
  grep -rn ' as any' \
    --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' \
    apps/ packages/ \
    | grep -v 'node_modules' | grep -v '.next/' \
    | head -20 >&2
  FAILED=1
fi

if [ "$ACTUAL_AS_TYPE" -gt "$MAX_AS_TYPE" ]; then
  echo "FAIL: Found $ACTUAL_AS_TYPE 'as Type' assertions in tests (max: $MAX_AS_TYPE)" >&2
  echo "New assertions found in:" >&2
  { grep -rn ' as [A-Z]' \
    --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' \
    apps/ packages/ \
    | grep -v 'node_modules' | grep -v '.next/' \
    | grep -v ' as const' \
    | grep -v ' as unknown' \
    | grep -v 'import \* as' \
    | grep -v 'import type.*as' \
    | grep -v '^\s*//' \
    | grep -v ' \* .*as [A-Z]' \
    | grep -v '".*as [A-Z].*"' \
    | grep -v "'.*as [A-Z].*'" \
    | grep -v '\`.*as [A-Z].*\`' \
    || true; } | head -30 >&2
  FAILED=1
fi

if [ "$ACTUAL_AS_UNKNOWN" -gt "$MAX_AS_UNKNOWN" ]; then
  echo "FAIL: Found $ACTUAL_AS_UNKNOWN 'as unknown as' assertions in tests (max: $MAX_AS_UNKNOWN)" >&2
  FAILED=1
fi

if [ "$FAILED" -eq 1 ]; then
  echo "" >&2
  echo "Fix: use vi.mocked(), instanceof guards, tabKey(), new Response(), or typed fixtures." >&2
  echo "See issue #142 for patterns." >&2
  exit 1
fi

# If counts went DOWN, remind to ratchet the budget
if [ "$ACTUAL_AS_TYPE" -lt "$MAX_AS_TYPE" ] || [ "$ACTUAL_AS_UNKNOWN" -lt "$MAX_AS_UNKNOWN" ]; then
  echo "NOTE: Assertion count decreased — update budgets in $0"
  echo "  as Type:    $ACTUAL_AS_TYPE (budget: $MAX_AS_TYPE)"
  echo "  as unknown: $ACTUAL_AS_UNKNOWN (budget: $MAX_AS_UNKNOWN)"
fi

echo "OK: Test assertions within budget (as Type: $ACTUAL_AS_TYPE/$MAX_AS_TYPE, as any: $ACTUAL_AS_ANY/$MAX_AS_ANY, as unknown: $ACTUAL_AS_UNKNOWN/$MAX_AS_UNKNOWN)"
