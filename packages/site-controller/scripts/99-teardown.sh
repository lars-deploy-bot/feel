#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_DOMAIN SITE_SLUG SERVICE_NAME

# Optional variables with defaults
REMOVE_USER=${REMOVE_USER:-false}
REMOVE_FILES=${REMOVE_FILES:-false}

log_info "Tearing down site: $SITE_DOMAIN"

wait_for_user_processes_to_exit() {
    local site_user=$1
    local attempts=$2

    for ((i=0; i<attempts; i++)); do
        if ! pgrep -u "$site_user" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done

    return 1
}

stop_lingering_user_processes() {
    local site_user=$1

    if ! pgrep -u "$site_user" >/dev/null 2>&1; then
        return 0
    fi

    log_info "Stopping lingering processes for user: $site_user"
    pkill -TERM -u "$site_user" >/dev/null 2>&1 || true

    if wait_for_user_processes_to_exit "$site_user" 10; then
        log_success "Lingering processes stopped for: $site_user"
        return 0
    fi

    log_warn "Processes still running for $site_user, sending SIGKILL"
    pkill -KILL -u "$site_user" >/dev/null 2>&1 || true

    if wait_for_user_processes_to_exit "$site_user" 5; then
        log_success "Lingering processes force-stopped for: $site_user"
        return 0
    fi

    log_error "Failed to stop lingering processes for: $site_user"
    pgrep -a -u "$site_user" >&2 || true
    return 1
}

# =============================================================================
# Stop systemd service
# =============================================================================

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

# =============================================================================
# Remove from Caddy configuration
# =============================================================================

# Get stream root from env or derive from script location
STREAM_ROOT="${STREAM_ROOT:-$(cd "$(dirname "$0")/../../.." && pwd)}"

# SERVER_CONFIG_PATH is required — no hardcoded domain fallbacks
SERVER_CONFIG="${SERVER_CONFIG_PATH:-}"
if [[ -z "$SERVER_CONFIG" ]]; then
    die "SERVER_CONFIG_PATH is required. Set it to the path of server-config.json"
fi
if [[ ! -f "$SERVER_CONFIG" ]]; then
    die "server-config.json not found at $SERVER_CONFIG"
fi

# Generator mode: Regenerate Caddyfile from database
# The domain should already be deleted from DB before this script runs.
# Regenerating will produce a Caddyfile without the deleted domain.
log_info "Using generator mode for Caddy configuration..."

cd "$STREAM_ROOT"
if bun run --cwd packages/site-controller routing:generate; then
    log_info "Validating Caddy configuration..."
    if caddy validate --config /etc/caddy/Caddyfile 2>/dev/null; then
        log_info "Reloading Caddy..."
        systemctl reload caddy || log_warn "Failed to reload Caddy"
        log_success "Caddy configuration regenerated"
    else
        log_warn "Caddy configuration validation failed"
    fi
else
    log_warn "Failed to regenerate Caddy configuration"
fi

# =============================================================================
# Remove environment file
# =============================================================================

if [[ -n "${ENV_FILE_PATH:-}" ]] && [[ -f "$ENV_FILE_PATH" ]]; then
    log_info "Removing environment file: $ENV_FILE_PATH"
    rm -f "$ENV_FILE_PATH"
fi

# =============================================================================
# Remove user if requested
# =============================================================================

if [[ "$REMOVE_USER" == "true" ]]; then
    SITE_USER="site-${SITE_SLUG}"
    if user_exists "$SITE_USER"; then
        log_info "Removing user: $SITE_USER"
        stop_lingering_user_processes "$SITE_USER" || die "Failed to stop processes for $SITE_USER"

        if userdel "$SITE_USER"; then
            log_success "User removed"
        else
            die "Failed to remove user: $SITE_USER"
        fi
    fi
fi

# =============================================================================
# Remove files if requested
# =============================================================================

if [[ "$REMOVE_FILES" == "true" ]]; then
    # Get sites root from env or use default
    # Note: SITES_ROOT (/srv/webalive/sites) is separate from BRIDGE_ROOT (/root/alive)
    # BRIDGE_ROOT = Alive application code
    # SITES_ROOT = Deployed website files and workspaces
    SITES_ROOT="${SITES_ROOT:-/srv/webalive/sites}"
    TARGET_DIR="${SITES_ROOT}/${SITE_DOMAIN}"

    if [[ -d "$TARGET_DIR" ]]; then
        log_info "Removing files: $TARGET_DIR"
        rm -rf "$TARGET_DIR"
        if [[ -e "$TARGET_DIR" ]]; then
            die "Failed to remove files: $TARGET_DIR"
        fi
        log_success "Files removed"
    fi

    # Remove symlink
    SYMLINK_PATH="${SITES_ROOT}/$(echo "$SITE_DOMAIN" | tr '.' '-')"
    if [[ -L "$SYMLINK_PATH" ]]; then
        rm -f "$SYMLINK_PATH"
    fi
fi

log_success "Teardown complete: $SITE_DOMAIN"
exit 0
