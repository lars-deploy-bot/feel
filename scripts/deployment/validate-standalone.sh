#!/bin/bash
# =============================================================================
# Validate Standalone Package Configuration
# =============================================================================
# Ensures packages imported by the app are included in the standalone build.
# Run this during CI/build to catch missing packages before deployment.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Load standalone packages config
source "$SCRIPT_DIR/lib/standalone-packages.sh"

ERRORS=0

echo "Validating standalone package configuration..."
echo ""

# -----------------------------------------------------------------------------
# Check 1: All STANDALONE_PACKAGES exist
# -----------------------------------------------------------------------------
echo "Checking packages exist..."
for pkg in "${STANDALONE_PACKAGES[@]}"; do
    if [ ! -d "$PROJECT_ROOT/packages/$pkg" ]; then
        echo -e "  ${RED}✗${NC} packages/$pkg does not exist"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${GREEN}✓${NC} packages/$pkg"
    fi
done
echo ""

# -----------------------------------------------------------------------------
# Check 2: Packages in next.config.js outputFileTracingIncludes are in our list
# -----------------------------------------------------------------------------
echo "Checking next.config.js consistency..."
NEXT_CONFIG="$PROJECT_ROOT/apps/web/next.config.js"

if [ -f "$NEXT_CONFIG" ]; then
    # Extract package names from outputFileTracingIncludes
    # Matches patterns like "../../packages/tools/**/*"
    # Note: grep returns exit code 1 when no matches found, which would fail with set -e
    NEXT_PACKAGES=$(grep -oE '\.\./\.\./packages/[a-z-]+' "$NEXT_CONFIG" 2>/dev/null | sed 's|../../packages/||' | sort -u || true)

    for next_pkg in $NEXT_PACKAGES; do
        # Skip guides - it's optional/documentation only
        [ "$next_pkg" = "guides" ] && continue

        FOUND=false
        for our_pkg in "${STANDALONE_PACKAGES[@]}"; do
            if [ "$next_pkg" = "$our_pkg" ]; then
                FOUND=true
                break
            fi
        done

        if [ "$FOUND" = false ]; then
            echo -e "  ${RED}✗${NC} Package '$next_pkg' in next.config.js but NOT in standalone-packages.sh"
            echo -e "     ${YELLOW}→ Add '$next_pkg' to STANDALONE_PACKAGES in lib/standalone-packages.sh${NC}"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "  ${GREEN}✓${NC} $next_pkg"
        fi
    done
else
    echo -e "  ${YELLOW}⚠${NC} next.config.js not found, skipping"
fi
echo ""

# -----------------------------------------------------------------------------
# Check 3: Standalone package list covers all workspace:* runtime dependencies
# -----------------------------------------------------------------------------
echo "Checking workspace dependency closure..."
set +e
CLOSURE_OUTPUT=$(bun - "$PROJECT_ROOT" "${STANDALONE_PACKAGES[@]}" 2>&1 <<'NODE'
const fs = require("node:fs")
const path = require("node:path")

const [, , projectRoot, ...standaloneDirs] = process.argv
if (!projectRoot || standaloneDirs.length === 0) {
  console.error("invalid arguments")
  process.exit(2)
}

function readPackageName(packageJsonPath) {
  const json = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
  return typeof json.name === "string" ? json.name : null
}

function collectWorkspacePackages(baseDir) {
  const out = new Map()
  if (!fs.existsSync(baseDir)) return out
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const packageJsonPath = path.join(baseDir, entry.name, "package.json")
    if (!fs.existsSync(packageJsonPath)) continue
    const pkgName = readPackageName(packageJsonPath)
    if (!pkgName) continue
    out.set(pkgName, packageJsonPath)
  }
  return out
}

const allWorkspace = new Map([
  ...collectWorkspacePackages(path.join(projectRoot, "packages")),
  ...collectWorkspacePackages(path.join(projectRoot, "apps")),
])

const standaloneByName = new Map()
const standaloneByDir = new Map()
for (const dir of standaloneDirs) {
  const packageJsonPath = path.join(projectRoot, "packages", dir, "package.json")
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`missing package directory: packages/${dir}`)
    process.exitCode = 1
    continue
  }
  const pkgName = readPackageName(packageJsonPath)
  if (!pkgName) {
    console.log(`missing package name: packages/${dir}/package.json`)
    process.exitCode = 1
    continue
  }
  standaloneByName.set(pkgName, dir)
  standaloneByDir.set(dir, { pkgName, packageJsonPath })
}

for (const [dir, meta] of standaloneByDir.entries()) {
  const pkg = JSON.parse(fs.readFileSync(meta.packageJsonPath, "utf8"))
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.optionalDependencies || {}),
  }
  for (const [depName, version] of Object.entries(deps)) {
    if (typeof version !== "string" || !version.startsWith("workspace:")) continue
    if (!allWorkspace.has(depName)) {
      console.log(`${meta.pkgName} -> ${depName} (workspace dependency not found in monorepo)`)
      process.exitCode = 1
      continue
    }
    if (!standaloneByName.has(depName)) {
      console.log(`${meta.pkgName} -> ${depName} (missing from STANDALONE_PACKAGES)`)
      process.exitCode = 1
    }
  }
}
NODE
)
CLOSURE_EXIT=$?
set -e

if [ $CLOSURE_EXIT -ne 0 ]; then
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        echo -e "  ${RED}✗${NC} $line"
    done <<< "$CLOSURE_OUTPUT"
    ERRORS=$((ERRORS + 1))
else
    echo -e "  ${GREEN}✓${NC} workspace dependency closure is complete"
fi
echo ""

# -----------------------------------------------------------------------------
# Check 4: SUBPROCESS_PACKAGES have required dependencies installed
# -----------------------------------------------------------------------------
echo "Checking subprocess package dependencies..."
for pkg in "${SUBPROCESS_PACKAGES[@]}"; do
    PKG_DIR="$PROJECT_ROOT/packages/$pkg"

    if [ ! -d "$PKG_DIR" ]; then
        continue
    fi

    # Check if node_modules exists (dependencies installed)
    if [ ! -d "$PKG_DIR/node_modules" ]; then
        echo -e "  ${YELLOW}⚠${NC} packages/$pkg/node_modules missing (run bun install)"
    else
        # For worker-pool, verify claude-agent-sdk exists (check both local and hoisted)
        if [ "$pkg" = "worker-pool" ]; then
            SDK_PATH="$PKG_DIR/node_modules/@anthropic-ai/claude-agent-sdk"
            ROOT_SDK_PATH="$PROJECT_ROOT/node_modules/@anthropic-ai/claude-agent-sdk"
            if [ -d "$SDK_PATH" ]; then
                if [ -f "$SDK_PATH/cli.js" ]; then
                    echo -e "  ${GREEN}✓${NC} packages/$pkg has claude-agent-sdk with cli.js"
                else
                    echo -e "  ${RED}✗${NC} packages/$pkg has SDK but missing cli.js"
                    ERRORS=$((ERRORS + 1))
                fi
            elif [ -d "$ROOT_SDK_PATH" ]; then
                # SDK is hoisted to root (monorepo behavior)
                if [ -f "$ROOT_SDK_PATH/cli.js" ]; then
                    echo -e "  ${GREEN}✓${NC} packages/$pkg has claude-agent-sdk (hoisted to root)"
                else
                    echo -e "  ${RED}✗${NC} packages/$pkg has SDK (hoisted) but missing cli.js"
                    ERRORS=$((ERRORS + 1))
                fi
            else
                echo -e "  ${RED}✗${NC} packages/$pkg missing @anthropic-ai/claude-agent-sdk"
                ERRORS=$((ERRORS + 1))
            fi
        else
            echo -e "  ${GREEN}✓${NC} packages/$pkg has node_modules"
        fi
    fi
done
echo ""

# -----------------------------------------------------------------------------
# Result
# -----------------------------------------------------------------------------
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}✗ Validation failed with $ERRORS error(s)${NC}"
    echo ""
    echo "Fix the issues above to prevent runtime errors in production."
    exit 1
else
    echo -e "${GREEN}✓ All standalone package checks passed${NC}"
    exit 0
fi
