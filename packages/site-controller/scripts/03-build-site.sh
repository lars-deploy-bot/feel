#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_USER SITE_DOMAIN SITE_PORT SITE_SLUG TARGET_DIR ENV_FILE_PATH

log_info "Building site: $SITE_DOMAIN"

# Create environment file for systemd service
log_info "Creating environment file: $ENV_FILE_PATH"
mkdir -p "$(dirname "$ENV_FILE_PATH")"
cat > "$ENV_FILE_PATH" <<EOF
DOMAIN=$SITE_DOMAIN
PORT=$SITE_PORT
EOF

# Generate config if script exists
if [[ -f "${TARGET_DIR}/../scripts/generate-config.js" ]]; then
    log_info "Generating site config..."
    cd "$(dirname "$TARGET_DIR")"
    bun run scripts/generate-config.js "$SITE_DOMAIN" "$SITE_PORT" || log_warn "Config generation failed, continuing..."
fi

# Fix ownership before build
log_info "Ensuring correct ownership..."
chown -R "$SITE_USER:$SITE_USER" "$TARGET_DIR"

# Install dependencies
log_info "Installing dependencies..."
cd "$TARGET_DIR"
if ! sudo -u "$SITE_USER" bun install; then
    log_error "Failed to install dependencies"
    exit 13
fi

# Run build if package.json has build script
if jq -e '.scripts.build' package.json &>/dev/null; then
    log_info "Running build..."
    if ! sudo -u "$SITE_USER" bun run build; then
        log_error "Build failed"
        exit 14
    fi
else
    log_info "No build script found, skipping build step"
fi

# Final ownership fix
chown -R "$SITE_USER:$SITE_USER" "$TARGET_DIR"

log_success "Site build complete: $SITE_DOMAIN"
exit 0
