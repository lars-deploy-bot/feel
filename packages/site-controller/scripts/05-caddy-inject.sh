#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# =============================================================================
# Caddy Configuration via Generator
# =============================================================================
# Instead of sed-editing the Caddyfile, we regenerate it from the database.
# This ensures the Caddyfile always matches the database state.
#
# Prerequisites:
# - SERVER_CONFIG_PATH env var points to server-config.json with serverId
# - Database has server_id column on domains table
# - Canonical production infra DB credentials are available via apps/web/.env.production

# Validate required environment variables
require_var SITE_DOMAIN

log_info "Configuring Caddy for: $SITE_DOMAIN"

# Get bridge root from env or derive from script location
STREAM_ROOT="${STREAM_ROOT:-$(cd "$(dirname "$0")/../../.." && pwd)}"
if [[ ! -d "$STREAM_ROOT" ]]; then
    log_error "STREAM_ROOT not found: $STREAM_ROOT"
    exit 15
fi

# SERVER_CONFIG_PATH is required — no hardcoded domain fallbacks
SERVER_CONFIG="${SERVER_CONFIG_PATH:-}"
if [[ -z "$SERVER_CONFIG" ]]; then
    die "SERVER_CONFIG_PATH is required. Set it to the path of server-config.json"
fi
if [[ ! -f "$SERVER_CONFIG" ]]; then
    die "server-config.json not found at $SERVER_CONFIG"
fi
if [[ ! -r "$SERVER_CONFIG" ]]; then
    die "server-config.json not readable at $SERVER_CONFIG"
fi

# Generator mode: regenerate from database (always used when SERVER_CONFIG_PATH is set)
if [[ -f "$SERVER_CONFIG" ]]; then
    log_info "Using generator mode (server-config.json found)"

    # Run the generator to regenerate Caddyfile.sites from database
    log_info "Regenerating Caddy configuration from database..."

    cd "$STREAM_ROOT"
    if ! bun run --cwd packages/site-controller routing:generate; then
        log_error "Failed to generate Caddy configuration"
        exit 16
    fi

    # Sync filtered Caddyfile for main import (excludes reserved env domains)
    if ! bun "$STREAM_ROOT/scripts/sync-generated-caddy.ts"; then
        log_error "Failed to sync filtered Caddy configuration"
        exit 16
    fi

    # Validate the generated config
    log_info "Validating Caddy configuration..."
    if ! caddy validate --config /etc/caddy/Caddyfile 2>/dev/null; then
        log_error "Caddy configuration validation failed"
        exit 17
    fi

    # Reload Caddy
    log_info "Reloading Caddy..."
    if ! systemctl reload caddy; then
        log_error "Failed to reload Caddy"
        exit 17
    fi

    log_success "Caddy configuration regenerated and reloaded"
fi

# =============================================================================
# Local Service Health Check (fast, reliable)
# =============================================================================
# We check localhost:port instead of the public URL because:
# 1. Cloudflare-proxied domains have unpredictable SSL provisioning times
# 2. DNS propagation is outside our control
# 3. The local service is what we actually deployed

check_local_service() {
    local port="$1"
    local max_attempts=5
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s -o /dev/null --max-time 2 "http://localhost:$port/" 2>/dev/null; then
            return 0
        fi
        log_info "  Attempt $attempt/$max_attempts - waiting for service on port $port..."
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Get port from environment or skip check
if [[ -n "${SITE_PORT:-}" ]]; then
    log_info "Checking local service on port $SITE_PORT"
    if check_local_service "$SITE_PORT"; then
        log_success "Local service responding on port $SITE_PORT"
    else
        log_warn "Local service not responding (systemd may still be starting)"
    fi
else
    log_info "Skipping local health check (SITE_PORT not set in generator mode)"
fi

log_success "Caddy configuration complete"
exit 0
