#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_USER SITE_HOME

log_info "Ensuring system user exists: $SITE_USER"

# In Docker, the container's /etc/passwd is a snapshot from deploy time.
# Always sync the host's user database so chown/sudo can resolve users.
if [[ -f /.dockerenv ]]; then
    nsenter --target 1 --mount -- cat /etc/passwd > /etc/passwd
    nsenter --target 1 --mount -- cat /etc/group > /etc/group
fi

# Check if user already exists (on the host)
if user_exists "$SITE_USER"; then
    log_success "User already exists: $SITE_USER"
    exit 0
fi

# Create system user
log_info "Creating system user: $SITE_USER"
host_run useradd --system \
    --home-dir "$SITE_HOME" \
    --shell /usr/sbin/nologin \
    "$SITE_USER"

# Sync again after creation so container sees the new user
if [[ -f /.dockerenv ]]; then
    nsenter --target 1 --mount -- cat /etc/passwd > /etc/passwd
    nsenter --target 1 --mount -- cat /etc/group > /etc/group
fi

# Verify user was created
if ! user_exists "$SITE_USER"; then
    die "Failed to create user: $SITE_USER"
fi

log_success "System user created: $SITE_USER"
exit 0
