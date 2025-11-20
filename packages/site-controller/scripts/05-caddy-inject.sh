#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_DOMAIN SITE_PORT CADDYFILE_PATH CADDY_LOCK_PATH FLOCK_TIMEOUT

log_info "Configuring Caddy for: $SITE_DOMAIN"

# Acquire lock on Caddyfile (30 second timeout)
log_info "Acquiring Caddyfile lock..."
exec 200>"$CADDY_LOCK_PATH"
if ! flock -w "$FLOCK_TIMEOUT" 200; then
    die "Failed to acquire Caddyfile lock after ${FLOCK_TIMEOUT}s"
fi

log_info "Lock acquired, updating Caddyfile..."

# Escape dots in domain for regex matching (example.com → example\.com)
ESCAPED_DOMAIN=$(echo "$SITE_DOMAIN" | sed 's/\./\\./g')

# Check if domain block already exists
if grep -q "^${SITE_DOMAIN} {" "$CADDYFILE_PATH"; then
    log_info "Domain block exists, updating port..."

    # Update the port in existing block (using escaped domain for safety)
    sed -i "/^${ESCAPED_DOMAIN} {/,/^}/ s/reverse_proxy localhost:[0-9]*/reverse_proxy localhost:${SITE_PORT}/" "$CADDYFILE_PATH"
else
    log_info "Domain block does not exist, creating new entry..."

    # Append new domain block with imports and headers
    cat >> "$CADDYFILE_PATH" <<EOF

${SITE_DOMAIN} {
    import common_headers
    import image_serving
    reverse_proxy localhost:${SITE_PORT} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
fi

log_success "Caddyfile updated"

# Release lock
flock -u 200

# Reload Caddy
log_info "Reloading Caddy..."
if ! systemctl reload caddy; then
    log_error "Failed to reload Caddy"
    exit 17
fi

# Wait for Caddy to reload
log_info "Waiting for Caddy to reload..."
sleep 2

# Verify site is accessible (allow failure for new domains)
log_info "Testing HTTPS endpoint: https://$SITE_DOMAIN"
if curl -f -s -I --max-time 10 "https://$SITE_DOMAIN" &>/dev/null; then
    log_success "Site is accessible via HTTPS"
else
    log_warn "Site not yet accessible via HTTPS (may take time for DNS/SSL)"
    log_warn "This is normal for new domains, SSL certificate will be provisioned automatically"
fi

log_success "Caddy configuration complete"
exit 0
