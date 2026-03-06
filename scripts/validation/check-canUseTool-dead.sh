#!/usr/bin/env bash
# 💣💣💣 canUseTool IS DEAD — THIS CHECK ENFORCES IT STAYS DEAD 💣💣💣
#
# The Claude Agent SDK (tested v0.2.41) NEVER calls the canUseTool callback.
# The CLI auto-approves all tools regardless of --permission-prompt-tool stdio.
# Any security logic in canUseTool is dead code that provides ZERO protection.
#
# Actual security: allowedTools/disallowedTools + cwd sandboxing + MCP validateWorkspacePath
#
# If a future SDK version fixes this, update this check AND re-verify with:
#   node scripts/verify-canUseTool-callback.mjs
#
# See CLAUDE.md rule #24 for full details.

set -euo pipefail

WORKER_ENTRY="packages/worker-pool/src/worker-entry.mjs"
ERRORS=0

echo "💣 Checking canUseTool stays dead in $WORKER_ENTRY..."

# 1. canUseTool must be set to undefined (disabled)
if ! grep -q 'canUseTool:disabled' "$WORKER_ENTRY"; then
  echo ""
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo "💣 MISSING canUseTool:disabled marker in worker-entry.mjs  💣"
  echo "💣 canUseTool must be 'undefined' — the SDK never calls it 💣"
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# 2. No "behavior: deny" — nobody should write deny logic in dead code
if grep -n 'behavior.*deny\|behavior.*"deny"' "$WORKER_ENTRY" | grep -v '^\s*//' | grep -v 'grep' > /dev/null 2>&1; then
  echo ""
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo "💣 FOUND 'behavior: deny' IN worker-entry.mjs                   💣"
  echo "💣 canUseTool IS NEVER CALLED BY THE SDK — deny logic is USELESS 💣"
  echo "💣 Put security in allowedTools/disallowedTools INSTEAD           💣"
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo ""
  grep -n 'behavior.*deny' "$WORKER_ENTRY" | grep -v '^\s*//'
  ERRORS=$((ERRORS + 1))
fi

# 3. No createStreamCanUseTool import — it's the dead callback factory
if grep -q 'createStreamCanUseTool' "$WORKER_ENTRY"; then
  echo ""
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo "💣 FOUND createStreamCanUseTool IN worker-entry.mjs             💣"
  echo "💣 This function creates a canUseTool callback that NEVER FIRES  💣"
  echo "💣 Remove it — it gives false confidence in dead security code   💣"
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# 4. No isHeavyBashCommand — was only used in dead canUseTool
if grep -q 'isHeavyBashCommand' "$WORKER_ENTRY"; then
  echo ""
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo "💣 FOUND isHeavyBashCommand IN worker-entry.mjs                 💣"
  echo "💣 This check was inside canUseTool which NEVER FIRES            💣"
  echo "💣 Move heavy-command blocking to disallowedTools or remove it   💣"
  echo "💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣💣"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "💣 $ERRORS canUseTool violation(s) found. The SDK never calls this callback."
  echo "💣 See: CLAUDE.md rule #24, scripts/verify-canUseTool-callback.mjs"
  echo ""
  exit 1
fi

echo "✅ canUseTool is properly disabled (no dead security code)"
