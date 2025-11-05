#!/bin/bash
# Atomic build script - prevents PM2 from serving half-built files
# Builds to dist/, moves to timestamped directory, then atomically swaps symlink

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

# Navigate to project root
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Configuration
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TEMP_BUILD_DIR="apps/web/dist"
TIMESTAMPED_DIR="apps/web/dist.${TIMESTAMP}"
SYMLINK="apps/web/dist"
WEB_DIR="apps/web"

log_info "Starting atomic build to dist.${TIMESTAMP}..."

# Remove existing temp build if it exists and is NOT a symlink
if [ -e "$TEMP_BUILD_DIR" ] && [ ! -L "$TEMP_BUILD_DIR" ]; then
    log_warn "Found non-symlink dist/ directory - moving to backup..."
    mv "$TEMP_BUILD_DIR" "${TEMP_BUILD_DIR}.backup.$(date +%s)"
fi

# If dist is a symlink, remove it temporarily for build
if [ -L "$TEMP_BUILD_DIR" ]; then
    OLD_TARGET=$(readlink "$TEMP_BUILD_DIR")
    log_info "Removing symlink (will restore after build)"
    rm "$TEMP_BUILD_DIR"
fi

# Build dependencies first (tools package)
log_info "Building workspace dependencies..."
cd packages/tools && bun run build && cd "$PROJECT_ROOT"

# Build web app to temp location
log_info "Building web app..."
BUILD_START=$(date +%s)

cd "$WEB_DIR"
if ! bun run build; then
    log_error "Build failed"

    cd "$PROJECT_ROOT"
    # Restore symlink if it existed
    if [ -n "${OLD_TARGET:-}" ]; then
        ln -sfn "$OLD_TARGET" "$SYMLINK"
        log_info "Restored previous symlink"
    fi
    exit 1
fi

cd "$PROJECT_ROOT"
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
log_success "Build completed in ${BUILD_TIME}s"

# Verify build output
if [ ! -d "$TEMP_BUILD_DIR" ]; then
    log_error "Build directory not found: $TEMP_BUILD_DIR"
    exit 1
fi

# Move build to timestamped directory
log_info "Moving build to timestamped directory..."
mv "$TEMP_BUILD_DIR" "$TIMESTAMPED_DIR"
log_success "Build moved to: dist.${TIMESTAMP}"

# Atomic symlink swap
log_info "Creating symlink: dist -> dist.${TIMESTAMP}"
cd "$WEB_DIR"
ln -sfn "dist.${TIMESTAMP}" "dist"
cd "$PROJECT_ROOT"
log_success "Symlink updated atomically"

# Cleanup old builds (keep last 3)
log_info "Cleaning up old builds..."
cd "$WEB_DIR"
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
cd "$WEB_DIR"
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
log_success "Atomic build complete! PM2 can now safely serve dist/"
