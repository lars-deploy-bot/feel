#!/bin/bash
# =============================================================================
# Atomic Build Script
# =============================================================================
# Builds to .builds/{env}/dist, then atomically swaps symlink.
# Called by build-and-serve.sh - don't run directly.
#
# Usage: ./build-atomic.sh <staging|production>
# Set CLEAN_BUILD=1 to force a full rebuild and clear caches first.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load shared libraries
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/standalone-packages.sh"

# =============================================================================
# Configuration
# =============================================================================
ENV="${1:-}"
if [[ ! "$ENV" =~ ^(staging|production)$ ]]; then
    log_error "Usage: $0 <staging|production>"
    log_error "Dev uses hot-reload (next dev) and does not use this script"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BUILDS_DIR="$PROJECT_ROOT/.builds/$ENV"
TEMP_BUILD_DIR="$BUILDS_DIR/dist"
TIMESTAMPED_DIR="$BUILDS_DIR/dist.$TIMESTAMP"
WEB_DIR="$PROJECT_ROOT/apps/web"
WEB_NEXT_DIR="$WEB_DIR/.next"
CLEAN_BUILD="${CLEAN_BUILD:-0}"

cd "$PROJECT_ROOT"

is_truthy() {
    case "${1:-}" in
        1|true|TRUE|yes|YES|on|ON)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# =============================================================================
# Cleanup on Failure
# =============================================================================
DEV_BACKUP=""
BUILD_CACHE_BACKUP=""

cleanup_failed_build() {
    local exit_code=$?
    [ $exit_code -eq 0 ] && return

    log_error "Build failed with exit code $exit_code"

    # Clean up temp build
    [ -d "$TEMP_BUILD_DIR" ] && rm -rf "${TEMP_BUILD_DIR:?}"

    # Restore dev server files
    if [ -n "$DEV_BACKUP" ] && [ -d "$DEV_BACKUP" ]; then
        mkdir -p "$WEB_NEXT_DIR"
        mv "$DEV_BACKUP" "$WEB_NEXT_DIR/dev" 2>/dev/null || true
        log_step "Dev server files restored"
    fi

    if [ -n "$BUILD_CACHE_BACKUP" ] && [ -d "$BUILD_CACHE_BACKUP" ]; then
        mkdir -p "$WEB_NEXT_DIR"
        mv "$BUILD_CACHE_BACKUP" "$WEB_NEXT_DIR/cache" 2>/dev/null || true
        log_step "Next.js cache restored"
    fi
}

trap cleanup_failed_build EXIT

# =============================================================================
# Phase 1: Pre-build Checks
# =============================================================================
log_step "Checking disk space..."
REQUIRED_MB=250
AVAILABLE_MB=$(df -BM "$PROJECT_ROOT" | tail -1 | awk '{print $4}' | sed 's/M//')
if [ "$AVAILABLE_MB" -lt "$REQUIRED_MB" ]; then
    log_error "Insufficient disk space: ${AVAILABLE_MB}MB available, ${REQUIRED_MB}MB required"
    exit 1
fi

mkdir -p "$BUILDS_DIR"

# =============================================================================
# Phase 2: Preserve Dev Server
# =============================================================================
if [ -d "$WEB_NEXT_DIR/dev" ]; then
    log_step "Backing up dev server files..."
    DEV_BACKUP="$WEB_NEXT_DIR.dev-backup"
    rm -rf "${DEV_BACKUP:?}" 2>/dev/null || true
    mv "$WEB_NEXT_DIR/dev" "$DEV_BACKUP"
fi

# =============================================================================
# Phase 3: Clean & Validate
# =============================================================================
log_step "Cleaning build artifacts..."
rm -rf "${WEB_DIR:?}/dist" 2>/dev/null || true

if [ -d "$WEB_NEXT_DIR" ]; then
    find "$WEB_NEXT_DIR" -mindepth 1 -maxdepth 1 ! -name "cache" ! -name "dev" -exec rm -rf {} + 2>/dev/null || true
fi

if is_truthy "$CLEAN_BUILD"; then
    log_step "Clean rebuild requested - clearing Next.js and Turbo caches..."
    rm -rf "${WEB_NEXT_DIR:?}/cache" "${PROJECT_ROOT:?}/.turbo" "${PROJECT_ROOT:?}/node_modules/.cache/turbo"
fi

log_step "Validating workspace..."
if ! "$SCRIPT_DIR/../validation/detect-workspace-issues.sh" >/dev/null 2>&1; then
    log_error "Workspace validation failed"
    exit 1
fi

log_step "Validating standalone packages..."
if ! "$SCRIPT_DIR/validate-standalone.sh" >/dev/null 2>&1; then
    log_error "Standalone package validation failed"
    "$SCRIPT_DIR/validate-standalone.sh"  # Run again to show errors
    exit 1
fi

# Remove circular symlinks from bun
rm -f templates/site-template/site-template 2>/dev/null || true
for pkg in packages/*/; do rm -f "$pkg/$(basename "$pkg")" 2>/dev/null || true; done

# =============================================================================
# Phase 4: Build
# =============================================================================

# Source env file so Next.js page-data collection sees runtime env vars
WEB_ENV_FILE="$PROJECT_ROOT/apps/web/.env.$ENV"
if [ -f "$WEB_ENV_FILE" ]; then
    set -a
    source "$WEB_ENV_FILE"
    set +a
    log_step "Loaded env from .env.$ENV"
fi

log_step "Building web dependencies..."
BUILD_START=$(date +%s)

BUILD_OUTPUT_LOG="/tmp/alive-nextjs-build-${ENV}.log"
DEPS_BUILD_ARGS=(run build --filter=@webalive/web^...)
if is_truthy "$CLEAN_BUILD"; then
    DEPS_BUILD_ARGS+=(--force)
fi

if ! bun "${DEPS_BUILD_ARGS[@]}" > "$BUILD_OUTPUT_LOG" 2>&1; then
    echo ""
    banner_error "DEPENDENCY BUILD FAILED"
    echo -e "  ${RED}Log: $BUILD_OUTPUT_LOG${NC}"
    echo ""
    grep -E "error TS|Error:|error:|Type error|Module not found|Cannot find" "$BUILD_OUTPUT_LOG" | head -30
    echo ""
    exit 1
fi

log_step "Building web app..."
if ! bun run --cwd "$WEB_DIR" build >> "$BUILD_OUTPUT_LOG" 2>&1; then
    echo ""
    banner_error "NEXT.JS BUILD FAILED"
    echo -e "  ${RED}Log: $BUILD_OUTPUT_LOG${NC}"
    echo ""
    grep -E "error TS|Error:|error:|Type error|Module not found|Cannot find" "$BUILD_OUTPUT_LOG" | tail -30
    echo ""
    exit 1
fi

BUILD_TIME=$(($(date +%s) - BUILD_START))
log_step "Build completed in ${BUILD_TIME}s"

# =============================================================================
# Phase 5: Verify Build Output
# =============================================================================
log_step "Verifying build output..."

[ ! -d "$WEB_NEXT_DIR/standalone" ] && { log_error "Standalone directory not found"; exit 1; }
[ ! -f "$WEB_NEXT_DIR/standalone/apps/web/server.js" ] && { log_error "server.js not found"; exit 1; }

# Verify critical chunks exist (ChunkLoadError = 500 on every request)
CHUNKS_DIR="$WEB_NEXT_DIR/server/chunks"
if [ ! -d "$CHUNKS_DIR" ]; then
    log_error "server/chunks directory missing — build is corrupt"
    exit 1
fi
CHUNK_COUNT=$(find "$CHUNKS_DIR" -name '*.js' -type f | wc -l)
if [ "$CHUNK_COUNT" -lt 10 ]; then
    log_error "Only $CHUNK_COUNT chunk files found (expected 10+) — build is corrupt"
    exit 1
fi

# Verify the stream route chunk specifically (most critical endpoint)
STREAM_ROUTE="$WEB_NEXT_DIR/server/app/api/claude/stream/route.js"
if [ ! -f "$STREAM_ROUTE" ]; then
    log_error "Stream route chunk missing: $STREAM_ROUTE"
    exit 1
fi
log_step "Build verified: $CHUNK_COUNT chunks, stream route present"

# Build size report
STANDALONE_SIZE=$(du -sm "$WEB_NEXT_DIR/standalone" 2>/dev/null | cut -f1)
NODE_MODULES_SIZE=$(du -sm "$WEB_NEXT_DIR/standalone/node_modules" 2>/dev/null | cut -f1)
PACKAGES_SIZE=$(du -sm "$WEB_NEXT_DIR/standalone/packages" 2>/dev/null | cut -f1)
TOTAL_SIZE=$(du -sm "$WEB_NEXT_DIR" 2>/dev/null | cut -f1)
log_step "Build size: ${TOTAL_SIZE}MB total (standalone: ${STANDALONE_SIZE}MB, node_modules: ${NODE_MODULES_SIZE}MB, packages: ${PACKAGES_SIZE}MB)"

# Flag unexpected bloat (thresholds based on known-good builds)
if [ "${STANDALONE_SIZE:-0}" -gt 500 ]; then
    log_warn "Standalone size ${STANDALONE_SIZE}MB exceeds 500MB — check for leaked .tmp dirs or duplicate deps"
    log_step "Top node_modules:"
    du -sm "$WEB_NEXT_DIR/standalone/node_modules"/* 2>/dev/null | sort -rn | head -5 | while read size dir; do
        log_step "  ${size}MB  $(basename "$dir")"
    done
fi

# =============================================================================
# Phase 6: Move to .builds
# =============================================================================
# Keep the Next.js compiler cache in the repo so incremental deploys can reuse it,
# but keep it out of the runtime artifact.
if [ -d "$WEB_NEXT_DIR/cache" ]; then
    BUILD_CACHE_BACKUP="$WEB_NEXT_DIR.cache-backup"
    rm -rf "${BUILD_CACHE_BACKUP:?}" 2>/dev/null || true
    mv "$WEB_NEXT_DIR/cache" "$BUILD_CACHE_BACKUP"
fi

# Remove dev server artifacts — the running dev server (alive-dev) recreates
# .next/dev/ during builds. Without this, 700+MB of dev cache leaks into every build.
rm -rf "$WEB_NEXT_DIR/dev" 2>/dev/null || true

log_step "Moving build to .builds..."
mv "$WEB_NEXT_DIR" "$TEMP_BUILD_DIR"

# Restore dev server
if [ -n "$DEV_BACKUP" ] && [ -d "$DEV_BACKUP" ]; then
    mkdir -p "$WEB_NEXT_DIR"
    mv "$DEV_BACKUP" "$WEB_NEXT_DIR/dev"
fi

if [ -n "$BUILD_CACHE_BACKUP" ] && [ -d "$BUILD_CACHE_BACKUP" ]; then
    mkdir -p "$WEB_NEXT_DIR"
    mv "$BUILD_CACHE_BACKUP" "$WEB_NEXT_DIR/cache"
fi

# =============================================================================
# Phase 7: Copy Static Assets
# =============================================================================
STANDALONE_DIR="$TEMP_BUILD_DIR/standalone/apps/web"

[ -d "$TEMP_BUILD_DIR/static" ] && {
    mkdir -p "$STANDALONE_DIR/.next"
    cp -r "$TEMP_BUILD_DIR/static" "$STANDALONE_DIR/.next/static"
}

[ -d "$WEB_DIR/public" ] && cp -r "$WEB_DIR/public" "$STANDALONE_DIR/public"
# =============================================================================
# Phase 8: Copy Workspace Packages
# =============================================================================
log_step "Copying workspace packages..."
STANDALONE_PACKAGES_DIR="$TEMP_BUILD_DIR/standalone/packages"
mkdir -p "$STANDALONE_PACKAGES_DIR"

# Use STANDALONE_PACKAGES array from lib/standalone-packages.sh (single source of truth)
for pkg in "${STANDALONE_PACKAGES[@]}"; do
    [ ! -d "packages/$pkg" ] && { log_error "Package not found: $pkg"; exit 1; }
    rm -rf "${STANDALONE_PACKAGES_DIR:?}/$pkg" 2>/dev/null || true
    # Use cp -rL to follow symlinks (bun creates symlinks to .bun/ cache)
    # This ensures dependencies like zod get copied as real files
    cp -rL "packages/$pkg" "$STANDALONE_PACKAGES_DIR/$pkg" 2>/dev/null || cp -r "packages/$pkg" "$STANDALONE_PACKAGES_DIR/$pkg"
done

# Template is NOT copied to standalone — site-controller reads it from
# $ALIVE_ROOT/templates/site-template at runtime (see packages/shared/src/config.ts PATHS.TEMPLATE_PATH)

# =============================================================================
# Phase 9: Link Packages to node_modules (single copy, no duplicate I/O)
# =============================================================================
log_step "Linking packages into node_modules..."
STANDALONE_NODE_MODULES="$STANDALONE_DIR/node_modules"
mkdir -p "$STANDALONE_NODE_MODULES"

declare -A STANDALONE_PACKAGE_NAME_TO_DIR=()
declare -A STANDALONE_PACKAGE_DIR_TO_NAME=()

# Build package-name lookup so we can support multiple scopes (e.g. @webalive/*, @alive-brug/*).
for pkg in "${STANDALONE_PACKAGES[@]}"; do
    PKG_DIR="$STANDALONE_PACKAGES_DIR/$pkg"
    PKG_JSON="$PKG_DIR/package.json"
    [ ! -f "$PKG_JSON" ] && { log_error "Missing package.json for standalone package: $pkg"; exit 1; }

    PKG_NAME=$(bun -e 'const fs=require("node:fs"); const p=process.argv[1]; const j=JSON.parse(fs.readFileSync(p,"utf8")); process.stdout.write(j.name || "");' "$PKG_JSON")
    [ -z "$PKG_NAME" ] && { log_error "Package name missing in $PKG_JSON"; exit 1; }

    STANDALONE_PACKAGE_NAME_TO_DIR["$PKG_NAME"]="$pkg"
    STANDALONE_PACKAGE_DIR_TO_NAME["$pkg"]="$PKG_NAME"
done

# Link copied workspace packages into standalone app node_modules.
# Relative links keep everything self-contained within standalone/ after timestamped move.
for pkg in "${STANDALONE_PACKAGES[@]}"; do
    [ ! -d "$STANDALONE_PACKAGES_DIR/$pkg" ] && { log_error "Standalone package missing: $pkg"; exit 1; }

    PKG_NAME="${STANDALONE_PACKAGE_DIR_TO_NAME[$pkg]}"
    if [[ "$PKG_NAME" == @*/* ]]; then
        PKG_SCOPE="${PKG_NAME%%/*}"
        PKG_BASENAME="${PKG_NAME#*/}"
        mkdir -p "$STANDALONE_NODE_MODULES/$PKG_SCOPE"
        rm -rf "${STANDALONE_NODE_MODULES:?}/$PKG_SCOPE/$PKG_BASENAME" 2>/dev/null || true
        ln -s "../../../../packages/$pkg" "$STANDALONE_NODE_MODULES/$PKG_SCOPE/$PKG_BASENAME"
    else
        rm -rf "${STANDALONE_NODE_MODULES:?}/$PKG_NAME" 2>/dev/null || true
        ln -s "../../../packages/$pkg" "$STANDALONE_NODE_MODULES/$PKG_NAME"
    fi
done

# Copy worker-entry.mjs (it's in src/ not dist/)
if [ -f "packages/worker-pool/src/worker-entry.mjs" ]; then
    mkdir -p "${STANDALONE_NODE_MODULES:?}/@webalive/worker-pool/dist/"
    cp "packages/worker-pool/src/worker-entry.mjs" "${STANDALONE_NODE_MODULES:?}/@webalive/worker-pool/dist/"
fi

# Link all workspace:* dependencies locally inside each copied package.
# This prevents fallback resolution to repo-level node_modules (split-brain risk).
log_step "Linking workspace dependencies inside standalone packages..."
for pkg in "${STANDALONE_PACKAGES[@]}"; do
    PKG_DIR="$STANDALONE_PACKAGES_DIR/$pkg"
    PKG_JSON="$PKG_DIR/package.json"
    PKG_NAME="${STANDALONE_PACKAGE_DIR_TO_NAME[$pkg]}"

    while IFS= read -r DEP_NAME; do
        [ -z "$DEP_NAME" ] && continue

        DEP_DIR="${STANDALONE_PACKAGE_NAME_TO_DIR[$DEP_NAME]:-}"
        if [ -z "$DEP_DIR" ]; then
            log_error "Workspace dependency '$DEP_NAME' required by '$PKG_NAME' is not in STANDALONE_PACKAGES"
            log_error "Add its package directory to scripts/deployment/lib/standalone-packages.sh"
            exit 1
        fi

        if [[ "$DEP_NAME" == @*/* ]]; then
            DEP_SCOPE="${DEP_NAME%%/*}"
            DEP_BASENAME="${DEP_NAME#*/}"
            mkdir -p "$PKG_DIR/node_modules/$DEP_SCOPE"
            rm -rf "$PKG_DIR/node_modules/$DEP_SCOPE/$DEP_BASENAME" 2>/dev/null || true
            ln -s "../../../$DEP_DIR" "$PKG_DIR/node_modules/$DEP_SCOPE/$DEP_BASENAME"
        else
            mkdir -p "$PKG_DIR/node_modules"
            rm -rf "$PKG_DIR/node_modules/$DEP_NAME" 2>/dev/null || true
            ln -s "../../$DEP_DIR" "$PKG_DIR/node_modules/$DEP_NAME"
        fi
    done < <(
        bun -e 'const fs=require("node:fs"); const p=process.argv[1]; const j=JSON.parse(fs.readFileSync(p,"utf8")); const deps={...(j.dependencies||{}), ...(j.optionalDependencies||{})}; for (const [name, version] of Object.entries(deps)) { if (typeof version==="string" && version.startsWith("workspace:")) console.log(name); }' "$PKG_JSON"
    )
done

# Copy zod dependency from the .bun cache (it's in the root standalone node_modules)
BUN_ZOD="$TEMP_BUILD_DIR/standalone/node_modules/.bun/node_modules/zod"
if [ -d "$BUN_ZOD" ]; then
    cp -rL "$BUN_ZOD" "$STANDALONE_NODE_MODULES/zod" 2>/dev/null || true
fi

log_step "Verifying hermetic workspace import resolution..."
bun "$SCRIPT_DIR/verify-hermetic-imports.mjs" "$TEMP_BUILD_DIR/standalone"

# =============================================================================
# Phase 10: Atomic Swap
# =============================================================================
log_step "Moving to timestamped directory..."
mv "$TEMP_BUILD_DIR" "$TIMESTAMPED_DIR"

log_step "Atomic symlink swap..."
cd "$BUILDS_DIR"
ln -sfn "dist.$TIMESTAMP" "current"
cd "$PROJECT_ROOT"

# Verify
ACTUAL=$(readlink "$BUILDS_DIR/current")
[ "$ACTUAL" != "dist.$TIMESTAMP" ] && { log_error "Symlink verification failed"; exit 1; }

log_step "Build: dist.$TIMESTAMP"
