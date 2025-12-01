#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_DOMAIN SITE_PORT CADDYFILE_PATH CADDY_LOCK_PATH FLOCK_TIMEOUT

log_info "Configuring Caddy for: $SITE_DOMAIN"

# Generate preview subdomain label (e.g., windowsxp.alive.best -> windowsxp-alive-best)
PREVIEW_LABEL=$(echo "$SITE_DOMAIN" | tr '.' '-')
PREVIEW_DOMAIN="${PREVIEW_LABEL}.preview.terminal.goalive.nl"
log_info "Preview subdomain: $PREVIEW_DOMAIN"

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

    # Append new domain block atomically using temp file
    TMP_FILE="${CADDYFILE_PATH}.tmp.$$"
    cp "$CADDYFILE_PATH" "$TMP_FILE"

    cat >> "$TMP_FILE" <<EOF

${SITE_DOMAIN} {
    import image_serving

    header {
        # Security headers (embeddable - allows iframe preview)
        -X-Frame-Options
        X-Content-Type-Options nosniff
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        -Server
        -X-Powered-By
    }

    reverse_proxy localhost:${SITE_PORT} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF

    # Atomic move
    mv "$TMP_FILE" "$CADDYFILE_PATH"
fi

# Also add/update preview subdomain block
ESCAPED_PREVIEW=$(echo "$PREVIEW_DOMAIN" | sed 's/\./\\./g')

if grep -q "^${PREVIEW_DOMAIN} {" "$CADDYFILE_PATH"; then
    log_info "Preview block exists, updating port..."
    sed -i "/^${ESCAPED_PREVIEW} {/,/^}/ s/reverse_proxy localhost:[0-9]*/reverse_proxy localhost:${SITE_PORT}/" "$CADDYFILE_PATH"
else
    log_info "Creating preview subdomain block..."

    TMP_FILE="${CADDYFILE_PATH}.tmp.$$"
    cp "$CADDYFILE_PATH" "$TMP_FILE"

    cat >> "$TMP_FILE" <<EOF

${PREVIEW_DOMAIN} {
    import image_serving

    reverse_proxy localhost:${SITE_PORT} {
        header_up Host localhost
    }

    header {
        # Security headers (embeddable variant)
        -X-Frame-Options
        Content-Security-Policy "frame-ancestors https://dev.terminal.goalive.nl https://terminal.goalive.nl https://staging.terminal.goalive.nl"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        -Server
        -X-Powered-By
    }

    # Auth check via forward_auth
    forward_auth localhost:8998 {
        uri /api/auth/preview-guard
        copy_headers Cookie
    }
}
EOF

    mv "$TMP_FILE" "$CADDYFILE_PATH"
fi

log_success "Caddyfile updated (main + preview)"

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
