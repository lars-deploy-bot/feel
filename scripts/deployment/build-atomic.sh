#!/bin/bash
# Atomic build script - prevents PM2 from serving half-built files
# Builds to .builds/{env}/dist, moves to timestamped directory, then atomically swaps symlink
#
# Usage: ./scripts/build-atomic.sh [environment]
# Examples:
#   ./scripts/build-atomic.sh prod     # Build to .builds/prod/dist.TIMESTAMP → .builds/prod/current
#   ./scripts/build-atomic.sh staging  # Build to .builds/staging/dist.TIMESTAMP → .builds/staging/current
#
# NOTE: Dev environment uses hot-reload (next dev) and does NOT use this script

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Cleanup function for failed builds
cleanup_failed_build() {
    local EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
        log_error "Build failed with exit code $EXIT_CODE"

        # Clean up temporary build directory if it exists
        if [ -n "${TEMP_BUILD_DIR:-}" ] && [ -d "$TEMP_BUILD_DIR" ]; then
            log_info "Cleaning up failed build directory..."
            rm -rf "$TEMP_BUILD_DIR"
            log_success "Cleaned up temporary build directory"
        fi

        # Restore dev server files if backup exists
        if [ -n "${DEV_BACKUP:-}" ] && [ -d "$DEV_BACKUP" ]; then
            log_info "Restoring dev server files from backup..."
            mkdir -p "${WEB_NEXT_DIR:-apps/web/.next}"
            mv "$DEV_BACKUP" "${WEB_NEXT_DIR}/dev" 2>/dev/null || true
            log_success "Dev server files restored"
        fi

        log_error "Build aborted - previous build remains active"
    fi
}

# Register cleanup trap
trap cleanup_failed_build EXIT

# Navigate to project root
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Verify required commands exist
log_info "Verifying required commands..."
if ! command -v bun &> /dev/null; then
    log_error "bun command not found. Please install Bun runtime."
    exit 1
fi

if ! command -v node &> /dev/null; then
    log_error "node command not found. Please install Node.js."
    exit 1
fi
log_success "Required commands verified (bun, node)"

# Get environment parameter (default: prod)
ENV="${1:-prod}"
if [[ ! "$ENV" =~ ^(prod|staging)$ ]]; then
    log_error "Invalid environment: $ENV. Must be 'prod' or 'staging'"
    log_error "Dev environment uses hot-reload (next dev) and does not use this script"
    exit 1
fi

# Configuration
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TEMP_BUILD_DIR=".builds/${ENV}/dist"
TIMESTAMPED_DIR=".builds/${ENV}/dist.${TIMESTAMP}"
SYMLINK=".builds/${ENV}/current"
WEB_DIR="apps/web"
WEB_NEXT_DIR="$WEB_DIR/.next"
BUILDS_DIR=".builds/${ENV}"

log_info "Starting atomic build of ${ENV} environment to dist.${TIMESTAMP}..."

# Check available disk space (require 250MB: ~127MB build + buffer)
REQUIRED_MB=250
AVAILABLE_MB=$(df -BM "$PROJECT_ROOT" | tail -1 | awk '{print $4}' | sed 's/M//')
if [ "$AVAILABLE_MB" -lt "$REQUIRED_MB" ]; then
    log_error "Insufficient disk space: ${AVAILABLE_MB}MB available, ${REQUIRED_MB}MB required"
    log_error "Clean up old builds or free disk space before building"
    exit 1
fi
log_info "Disk space check: ${AVAILABLE_MB}MB available (${REQUIRED_MB}MB required)"

# Ensure .builds directory exists
mkdir -p "$BUILDS_DIR"

# Preserve dev server files if they exist
DEV_BACKUP=""
if [ -d "$WEB_NEXT_DIR/dev" ]; then
    log_info "Backing up dev server files..."
    DEV_BACKUP="$WEB_NEXT_DIR.dev-backup"
    # Remove any stale backup from previous failed builds
    if [ -d "$DEV_BACKUP" ]; then
        log_warn "Stale dev backup found, removing..."
        rm -rf "$DEV_BACKUP"
    fi
    mv "$WEB_NEXT_DIR/dev" "$DEV_BACKUP"
fi

# Clean up any existing production .next build
if [ -d "$WEB_NEXT_DIR" ]; then
    log_info "Removing existing production .next build..."
    rm -rf "$WEB_NEXT_DIR"
fi

# Clean up stale dist directory if it exists (prevents type validation errors)
if [ -d "$WEB_DIR/dist" ]; then
    log_info "Removing stale dist directory..."
    rm -rf "$WEB_DIR/dist"
fi

# Build dependencies first (images + tools + deploy-scripts packages)
log_info "Building workspace dependencies..."

# Build images package
if [ ! -d "packages/images" ]; then
    log_error "Package not found: packages/images"
    exit 1
fi
log_info "Building packages/images..."
cd packages/images
if ! bun run build; then
    log_error "Failed to build images package"
    cd "$PROJECT_ROOT"
    exit 1
fi
cd "$PROJECT_ROOT"
log_success "Built packages/images"

# Build tools package
if [ ! -d "packages/tools" ]; then
    log_error "Package not found: packages/tools"
    exit 1
fi
log_info "Building packages/tools..."
cd packages/tools
if ! bun run build; then
    log_error "Failed to build tools package"
    cd "$PROJECT_ROOT"
    exit 1
fi
cd "$PROJECT_ROOT"
log_success "Built packages/tools"

# Build deploy-scripts package
if [ ! -d "packages/deploy-scripts" ]; then
    log_error "Package not found: packages/deploy-scripts"
    exit 1
fi
log_info "Building packages/deploy-scripts..."
cd packages/deploy-scripts
if ! bun run build; then
    log_error "Failed to build deploy-scripts package"
    cd "$PROJECT_ROOT"
    exit 1
fi
cd "$PROJECT_ROOT"
log_success "Built packages/deploy-scripts"

log_success "All workspace dependencies built successfully"

# Build web app to temp location
log_info "Building web app..."
BUILD_START=$(date +%s)

cd "$WEB_DIR"
if ! bun run build; then
    log_error "Build failed"
    cd "$PROJECT_ROOT"
    exit 1
fi

cd "$PROJECT_ROOT"
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
log_success "Build completed in ${BUILD_TIME}s"

# Verify .next build output exists and has required structure
log_info "Verifying build output structure..."
if [ ! -d "$WEB_NEXT_DIR" ]; then
    log_error "Build directory not found: $WEB_NEXT_DIR"
    exit 1
fi

# Verify standalone directory exists (Next.js output=standalone mode)
if [ ! -d "$WEB_NEXT_DIR/standalone" ]; then
    log_error "Standalone directory not found: $WEB_NEXT_DIR/standalone"
    log_error "Ensure next.config.ts has output: 'standalone' configured"
    exit 1
fi

# Verify server.js exists (required for production)
if [ ! -f "$WEB_NEXT_DIR/standalone/apps/web/server.js" ]; then
    log_error "Server entry point not found: $WEB_NEXT_DIR/standalone/apps/web/server.js"
    log_error "Next.js standalone build may have failed"
    exit 1
fi

log_success "Build output structure verified"

# Move .next to .builds/dist
log_info "Moving build to .builds/dist..."
mv "$WEB_NEXT_DIR" "$TEMP_BUILD_DIR"
log_success "Build moved to temporary location"

# Restore dev server files if they were backed up
if [ -n "$DEV_BACKUP" ] && [ -d "$DEV_BACKUP" ]; then
    log_info "Restoring dev server files..."
    mkdir -p "$WEB_NEXT_DIR"
    mv "$DEV_BACKUP" "$WEB_NEXT_DIR/dev"
    log_success "Dev server files restored"
fi

# Copy static assets into standalone directory for Next.js standalone mode
log_info "Copying static assets to standalone directory..."
STANDALONE_DIR="$TEMP_BUILD_DIR/standalone/apps/web"

# Copy entire .next/static to standalone
if [ -d "$TEMP_BUILD_DIR/static" ]; then
    mkdir -p "$STANDALONE_DIR/.next"
    cp -r "$TEMP_BUILD_DIR/static" "$STANDALONE_DIR/.next/static"
    log_success "Copied .next/static to standalone"
fi

# Copy public directory if it exists
if [ -d "$WEB_DIR/public" ]; then
    cp -r "$WEB_DIR/public" "$STANDALONE_DIR/public"
    log_success "Copied public directory to standalone"
fi

# Copy workspace packages to standalone (Next.js file tracing doesn't handle symlinked workspaces)
log_info "Copying workspace packages to standalone..."
STANDALONE_PACKAGES="$TEMP_BUILD_DIR/standalone/packages"
mkdir -p "$STANDALONE_PACKAGES" || {
    log_error "Failed to create packages directory: $STANDALONE_PACKAGES"
    exit 1
}

REQUIRED_PACKAGES=("tools" "images" "template" "guides" "deploy-scripts")
COPIED_PACKAGES=0

for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if [ ! -d "packages/$pkg" ]; then
        log_error "Required package not found: packages/$pkg"
        log_error "All workspace packages must exist before building"
        exit 1
    fi

    if ! cp -r "packages/$pkg" "$STANDALONE_PACKAGES/$pkg"; then
        log_error "Failed to copy packages/$pkg to standalone"
        exit 1
    fi

    # Remove any symlinks that may have been copied (prevents circular reference issues)
    find "$STANDALONE_PACKAGES/$pkg" -type l -delete 2>/dev/null

    # Verify package.json exists
    if [ ! -f "$STANDALONE_PACKAGES/$pkg/package.json" ]; then
        log_error "Package $pkg is missing package.json"
        exit 1
    fi

    COPIED_PACKAGES=$((COPIED_PACKAGES + 1))
    log_success "Copied packages/$pkg to standalone (symlinks removed)"
done

log_success "Verified and copied all $COPIED_PACKAGES required packages"

# Create node_modules symlinks for workspace packages (required for Bun module resolution)
log_info "Creating node_modules symlinks for workspace packages..."
STANDALONE_NODE_MODULES="$STANDALONE_DIR/node_modules"

if ! mkdir -p "$STANDALONE_NODE_MODULES/@alive-brug"; then
    log_error "Failed to create node_modules directory: $STANDALONE_NODE_MODULES/@alive-brug"
    exit 1
fi

CREATED_LINKS=0
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if [ -d "$STANDALONE_PACKAGES/$pkg" ]; then
        if ! ln -sf "../../../../packages/$pkg" "$STANDALONE_NODE_MODULES/@alive-brug/$pkg"; then
            log_error "Failed to create symlink for package: $pkg"
            exit 1
        fi
        CREATED_LINKS=$((CREATED_LINKS + 1))
        log_success "Linked @alive-brug/$pkg -> ../../../../packages/$pkg"
    else
        log_error "Package directory not found: $STANDALONE_PACKAGES/$pkg"
        log_error "Package should have been copied in previous step"
        exit 1
    fi
done

log_success "Created $CREATED_LINKS package symlinks"

# Verify all symlinks resolve correctly (fail fast if broken)
log_info "Verifying workspace package symlinks..."
BROKEN_LINKS=0
for pkg in tools images template guides deploy-scripts; do
    LINK_PATH="$STANDALONE_NODE_MODULES/@alive-brug/$pkg"
    if [ -L "$LINK_PATH" ]; then
        # Symlink exists, verify it resolves to a valid directory
        if [ ! -d "$LINK_PATH" ]; then
            log_error "Broken symlink: @alive-brug/$pkg does not resolve to valid directory"
            log_error "  Link: $LINK_PATH"
            log_error "  Target: $(readlink "$LINK_PATH")"
            BROKEN_LINKS=$((BROKEN_LINKS + 1))
        else
            log_success "Verified @alive-brug/$pkg symlink"
        fi
    else
        log_warn "Missing symlink for package: $pkg (package may not exist)"
    fi
done

if [ $BROKEN_LINKS -gt 0 ]; then
    log_error "Build failed: $BROKEN_LINKS broken package symlink(s) detected"
    log_error "This will cause runtime errors when importing workspace packages"
    exit 1
fi

# Move build to timestamped directory
log_info "Moving build to timestamped directory..."
if ! mv "$TEMP_BUILD_DIR" "$TIMESTAMPED_DIR"; then
    log_error "Failed to move build to timestamped directory"
    log_error "Source: $TEMP_BUILD_DIR"
    log_error "Destination: $TIMESTAMPED_DIR"
    exit 1
fi
log_success "Build moved to: dist.${TIMESTAMP}"

# Verify the timestamped directory exists and contains expected files
if [ ! -d "$TIMESTAMPED_DIR/standalone/apps/web" ]; then
    log_error "Build directory verification failed: $TIMESTAMPED_DIR/standalone/apps/web not found"
    exit 1
fi

if [ ! -f "$TIMESTAMPED_DIR/standalone/apps/web/server.js" ]; then
    log_error "Build verification failed: server.js not found in timestamped directory"
    exit 1
fi

log_success "Build directory verified"

# Atomic symlink swap
log_info "Creating symlink: current -> dist.${TIMESTAMP}"
cd "$BUILDS_DIR" || {
    log_error "Failed to change to builds directory: $BUILDS_DIR"
    exit 1
}

if ! ln -sfn "dist.${TIMESTAMP}" "current"; then
    log_error "Failed to create current symlink"
    cd "$PROJECT_ROOT"
    exit 1
fi

cd "$PROJECT_ROOT"
log_success "Symlink updated atomically"

# Verify the symlink points to the correct build
ACTUAL_TARGET=$(readlink "$SYMLINK")
if [ "$ACTUAL_TARGET" != "dist.${TIMESTAMP}" ]; then
    log_error "Symlink verification failed"
    log_error "Expected: dist.${TIMESTAMP}"
    log_error "Actual: $ACTUAL_TARGET"
    exit 1
fi
log_success "Symlink verified: $SYMLINK -> $ACTUAL_TARGET"

# Cleanup old builds (keep last 3)
log_info "Cleaning up old builds..."
cd "$BUILDS_DIR"
OLD_BUILDS=$(ls -dt dist.* 2>/dev/null | tail -n +4)
if [ -n "$OLD_BUILDS" ]; then
    echo "$OLD_BUILDS" | xargs rm -rf
    log_success "Removed old builds"
else
    log_info "No old builds to remove"
fi
cd "$PROJECT_ROOT"

# Show build info
ACTUAL_TARGET=$(readlink "$SYMLINK")
log_success "Active build: $ACTUAL_TARGET"

# List all builds with sizes
log_info "Available builds:"
cd "$BUILDS_DIR"
ls -dt dist.* 2>/dev/null | while read dir; do
    SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1)
    if [ "dist.${TIMESTAMP}" = "$dir" ]; then
        echo "  → $(basename $dir) ($SIZE) [ACTIVE]"
    else
        echo "    $(basename $dir) ($SIZE)"
    fi
done
cd "$PROJECT_ROOT"

echo ""
log_success "Atomic build complete! PM2 can now safely serve .builds/${ENV}/current"
