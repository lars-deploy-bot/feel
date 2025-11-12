#!/bin/bash
# Atomic build script - prevents PM2 from serving half-built files
# Builds to .builds/dist, moves to timestamped directory, then atomically swaps symlink

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
TEMP_BUILD_DIR=".builds/dist"
TIMESTAMPED_DIR=".builds/dist.${TIMESTAMP}"
SYMLINK=".builds/current"
WEB_DIR="apps/web"
WEB_NEXT_DIR="$WEB_DIR/.next"
BUILDS_DIR=".builds"

log_info "Starting atomic build to dist.${TIMESTAMP}..."

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

# Build dependencies first (images + tools packages)
log_info "Building workspace dependencies..."
cd packages/images && bun run build && cd "$PROJECT_ROOT" || { log_error "Failed to build images package"; exit 1; }
cd packages/tools && bun run build && cd "$PROJECT_ROOT" || { log_error "Failed to build tools package"; exit 1; }

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

# Verify .next build output exists
if [ ! -d "$WEB_NEXT_DIR" ]; then
    log_error "Build directory not found: $WEB_NEXT_DIR"
    exit 1
fi

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
mkdir -p "$STANDALONE_PACKAGES"

for pkg in tools images template guides; do
    if [ -d "packages/$pkg" ]; then
        cp -r "packages/$pkg" "$STANDALONE_PACKAGES/$pkg"
        log_success "Copied packages/$pkg to standalone"
    fi
done

# Move build to timestamped directory
log_info "Moving build to timestamped directory..."
mv "$TEMP_BUILD_DIR" "$TIMESTAMPED_DIR"
log_success "Build moved to: dist.${TIMESTAMP}"

# Atomic symlink swap
log_info "Creating symlink: current -> dist.${TIMESTAMP}"
cd "$BUILDS_DIR"
ln -sfn "dist.${TIMESTAMP}" "current"
cd "$PROJECT_ROOT"
log_success "Symlink updated atomically"

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
log_success "Atomic build complete! PM2 can now safely serve .builds/current"
