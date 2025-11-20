#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_DOMAIN SITE_SLUG SERVICE_NAME

# Optional variables with defaults
REMOVE_USER=${REMOVE_USER:-false}
REMOVE_FILES=${REMOVE_FILES:-false}
REMOVE_PORT=${REMOVE_PORT:-true}

log_info "Tearing down site: $SITE_DOMAIN"

# Stop systemd service
if service_exists "$SERVICE_NAME"; then
    log_info "Stopping service: $SERVICE_NAME"
    systemctl stop "$SERVICE_NAME" || log_warn "Failed to stop service"

    log_info "Disabling service: $SERVICE_NAME"
    systemctl disable "$SERVICE_NAME" || log_warn "Failed to disable service"

    systemctl daemon-reload
    log_success "Service stopped and disabled"
else
    log_info "Service does not exist, skipping: $SERVICE_NAME"
fi

# Remove from Caddy configuration
if [[ -n "${CADDYFILE_PATH:-}" ]] && [[ -f "$CADDYFILE_PATH" ]]; then
    log_info "Removing from Caddy configuration..."

    # Acquire lock
    CADDY_LOCK_PATH=${CADDY_LOCK_PATH:-/tmp/caddyfile.lock}
    exec 200>"$CADDY_LOCK_PATH"
    flock -w 30 200 || log_warn "Failed to acquire Caddyfile lock"

    # Escape dots in domain for regex matching
    ESCAPED_DOMAIN=$(echo "$SITE_DOMAIN" | sed 's/\./\\./g')

    # Remove domain block
    if grep -q "^${SITE_DOMAIN} {" "$CADDYFILE_PATH"; then
        # Use sed to remove domain block (from "domain {" to next "}")
        sed -i "/^${ESCAPED_DOMAIN} {/,/^}/d" "$CADDYFILE_PATH"

        # Remove any empty lines left behind
        sed -i '/^$/N;/^\n$/d' "$CADDYFILE_PATH"

        log_success "Removed from Caddyfile"

        # Reload Caddy
        systemctl reload caddy || log_warn "Failed to reload Caddy"
    else
        log_info "Domain not found in Caddyfile"
    fi

    flock -u 200
fi

# Remove environment file
if [[ -n "${ENV_FILE_PATH:-}" ]] && [[ -f "$ENV_FILE_PATH" ]]; then
    log_info "Removing environment file: $ENV_FILE_PATH"
    rm -f "$ENV_FILE_PATH"
fi

# Remove port from registry (if requested)
if [[ "$REMOVE_PORT" == "true" ]]; then
    if [[ -n "${REGISTRY_PATH:-}" ]] && [[ -f "$REGISTRY_PATH" ]]; then
        log_info "Removing port assignment from registry..."
        TMP_FILE="${REGISTRY_PATH}.tmp.$$"
        jq --arg domain "$SITE_DOMAIN" 'del(.[$domain])' "$REGISTRY_PATH" > "$TMP_FILE"
        mv "$TMP_FILE" "$REGISTRY_PATH"
        log_success "Port assignment removed"
    fi
else
    log_info "Keeping port assignment in registry (REMOVE_PORT=false)"
fi

# Remove user if requested
if [[ "$REMOVE_USER" == "true" ]]; then
    SITE_USER="site-${SITE_SLUG}"
    if user_exists "$SITE_USER"; then
        log_info "Removing user: $SITE_USER"
        userdel "$SITE_USER" || log_warn "Failed to remove user"
        log_success "User removed"
    fi
fi

# Remove files if requested
if [[ "$REMOVE_FILES" == "true" ]]; then
    TARGET_DIR="/srv/webalive/sites/${SITE_DOMAIN}"
    if [[ -d "$TARGET_DIR" ]]; then
        log_info "Removing files: $TARGET_DIR"
        rm -rf "$TARGET_DIR"
        log_success "Files removed"
    fi

    # Remove symlink
    SYMLINK_PATH="/srv/webalive/sites/$(echo "$SITE_DOMAIN" | tr '.' '-')"
    if [[ -L "$SYMLINK_PATH" ]]; then
        rm -f "$SYMLINK_PATH"
    fi
fi

log_success "Teardown complete: $SITE_DOMAIN"
exit 0
