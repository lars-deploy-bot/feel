#!/bin/bash

# Generate Supabase database types for all schemas
#
# This script generates TypeScript types from the Supabase database schemas.
# It can be run from anywhere in the project.
#
# Usage:
#   ./scripts/database/generate-types.sh
#   bun run db:types (from root or apps/web)
#
# Environment:
#   Reads .env from apps/web for SUPABASE_PROJECT_ID and SUPABASE_ACCESS_TOKEN

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Find project root (look for package.json with "name": "claude-bridge")
find_project_root() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" ]] && grep -q '"name".*"claude-bridge"' "$dir/package.json" 2>/dev/null; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done

  # Try to load from generated config relative to this script
  local script_root
  script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local config_file="$script_root/packages/shared/environments.json"
  local config_root=""
  if [[ -f "$config_file" ]]; then
    config_root="$(jq -r '.PATHS.BRIDGE_ROOT // empty' "$config_file" 2>/dev/null || true)"
    if [[ -n "$config_root" && -d "$config_root" ]]; then
      echo "$config_root"
      return 0
    fi
  fi

  echo "Error: Could not find project root" >&2
  echo "Searched upward from $PWD for package.json with 'name': 'claude-bridge'" >&2
  echo "Also tried loading PATHS.BRIDGE_ROOT from packages/shared/environments.json" >&2
  return 1
}

# Get project root
PROJECT_ROOT=$(find_project_root)
if [[ -z "$PROJECT_ROOT" ]]; then
  echo -e "${RED}❌ Could not find project root${NC}"
  exit 1
fi

echo -e "${YELLOW}🔄 Generating Supabase database types...${NC}"
echo "   Project root: $PROJECT_ROOT"

# Change to apps/web directory
cd "$PROJECT_ROOT/apps/web" || {
  echo -e "${RED}❌ Could not find apps/web directory${NC}"
  exit 1
}

# Verify bun is available
if ! command -v bun &> /dev/null; then
  echo -e "${RED}❌ bun is not installed or not in PATH${NC}"
  exit 1
fi

# Check if the TypeScript generation script exists
if [[ ! -f "scripts/generate-db-types-improved.ts" ]]; then
  echo -e "${RED}❌ TypeScript generation script not found at apps/web/scripts/generate-db-types-improved.ts${NC}"
  exit 1
fi

# Run the existing TypeScript script using bun
echo -e "${YELLOW}📊 Running type generation...${NC}"
if bun run scripts/generate-db-types-improved.ts; then
  echo -e "${GREEN}✅ Database types generated successfully!${NC}"
  echo ""
  echo "Generated files:"
  echo "  • apps/web/lib/supabase/iam.types.ts"
  echo "  • apps/web/lib/supabase/app.types.ts"
  echo "  • apps/web/lib/supabase/lockbox.types.ts"
else
  echo -e "${RED}❌ Type generation failed${NC}"
  echo ""
  echo "Common issues:"
  echo "  • Missing SUPABASE_ACCESS_TOKEN in apps/web/.env"
  echo "  • Missing SUPABASE_PROJECT_ID in apps/web/.env"
  echo "  • Network connectivity issues"
  echo ""
  echo "To get your access token:"
  echo "  1. Go to https://supabase.com/dashboard/account/tokens"
  echo "  2. Create a new access token"
  echo "  3. Add to apps/web/.env: SUPABASE_ACCESS_TOKEN=your_token_here"
  exit 1
fi