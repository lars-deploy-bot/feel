#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_DOMAIN REGISTRY_PATH

log_info "Assigning port for domain: $SITE_DOMAIN"

# Ensure registry file exists
if [[ ! -f "$REGISTRY_PATH" ]]; then
    log_warn "Registry file not found, creating: $REGISTRY_PATH"
    mkdir -p "$(dirname "$REGISTRY_PATH")"
    echo '{}' > "$REGISTRY_PATH"
fi

# 🔒 CRITICAL: Acquire lock BEFORE reading registry to prevent race condition
# This ensures atomic read-modify-write transaction across concurrent deployments
LOCK_FILE="${REGISTRY_PATH}.lock"
log_info "Acquiring port registry lock..."
exec 200>"$LOCK_FILE"
if ! flock -w 30 200; then
    die "Failed to acquire port registry lock after 30 seconds (another deployment in progress)"
fi

log_info "Lock acquired, checking port assignment..."

# Check if domain already has a port
EXISTING_PORT=$(jq -r --arg domain "$SITE_DOMAIN" '.[$domain].port // empty' "$REGISTRY_PATH")

if [[ -n "$EXISTING_PORT" ]]; then
    # Verify the existing port is still available
    if port_in_use "$EXISTING_PORT"; then
        log_warn "Existing port $EXISTING_PORT is now occupied, reassigning..."
        # Port is occupied, need to find a new one (continue to assignment logic below)
        EXISTING_PORT=""  # Clear to trigger new assignment
    else
        log_success "Domain already has assigned port: $EXISTING_PORT"
        flock -u 200  # Release lock before exit
        echo "$EXISTING_PORT"
        exit 0
    fi
fi

# Find the maximum port currently in use (in range 3333-3999)
log_info "Finding next available port..."
MAX_PORT=$(jq -r '.[] | select(.port >= 3333 and .port <= 3999) | .port' "$REGISTRY_PATH" 2>/dev/null | sort -n | tail -1)

if [[ -z "$MAX_PORT" ]]; then
    NEXT_PORT=3333
else
    NEXT_PORT=$((MAX_PORT + 1))
fi

# Ensure we're within range
if [[ $NEXT_PORT -gt 3999 ]]; then
    die "No available ports in range 3333-3999"
fi

# Double-check port is not in use on system
while port_in_use "$NEXT_PORT"; do
    log_warn "Port $NEXT_PORT appears to be in use, trying next..."
    NEXT_PORT=$((NEXT_PORT + 1))
    if [[ $NEXT_PORT -gt 3999 ]]; then
        die "No available ports in range 3333-3999"
    fi
done

log_info "Assigning port: $NEXT_PORT"

# Update registry atomically
TMP_FILE="${REGISTRY_PATH}.tmp.$$"
jq --arg domain "$SITE_DOMAIN" --argjson port "$NEXT_PORT" \
    '.[$domain].port = $port' "$REGISTRY_PATH" > "$TMP_FILE"
mv "$TMP_FILE" "$REGISTRY_PATH"

log_success "Port assigned: $NEXT_PORT"

# Release lock after successful write
flock -u 200

echo "$NEXT_PORT"
exit 0
