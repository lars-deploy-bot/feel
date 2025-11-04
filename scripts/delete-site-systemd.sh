#!/bin/bash

# Secure Website Deletion Script
# Usage: ./delete-site-systemd.sh domain.com
#
# This script:
# - Stops and disables systemd service
# - Removes site directory
# - Removes Caddy configuration
# - Removes from domain-passwords.json
# - Reloads Caddy

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 domain.com"
    echo "Example: $0 oldsite.com"
    exit 2
fi

DOMAIN=$1
SLUG=${DOMAIN//[^a-zA-Z0-9]/-}
SERVICE_NAME="site@${SLUG}.service"
USER="site-${SLUG}"
OLD_SITE_DIR="/root/webalive/sites/$DOMAIN"
NEW_SITE_DIR="/srv/webalive/sites/$DOMAIN"
CADDYFILE="/root/webalive/claude-bridge/Caddyfile"
DOMAIN_PASSWORDS_FILE="/root/webalive/claude-bridge/domain-passwords.json"

echo "🗑️  Deleting $DOMAIN..."

# Track failures
FAILED=0

# 1. Stop and disable systemd service
echo "Stopping systemd service: $SERVICE_NAME"
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    if ! systemctl stop "$SERVICE_NAME"; then
        echo "⚠️  Failed to stop $SERVICE_NAME"
        FAILED=1
    else
        echo "✅ Service stopped"
    fi
else
    echo "ℹ️  Service not running"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    if ! systemctl disable "$SERVICE_NAME"; then
        echo "⚠️  Failed to disable $SERVICE_NAME"
        FAILED=1
    else
        echo "✅ Service disabled"
    fi
else
    echo "ℹ️  Service not enabled"
fi

# 2. Remove site directory (check both locations)
SITE_DIR=""
if [ -d "$NEW_SITE_DIR" ]; then
    SITE_DIR="$NEW_SITE_DIR"
elif [ -d "$OLD_SITE_DIR" ]; then
    SITE_DIR="$OLD_SITE_DIR"
fi

if [ -n "$SITE_DIR" ]; then
    echo "Removing site directory: $SITE_DIR"
    if ! rm -rf "$SITE_DIR"; then
        echo "⚠️  Failed to remove $SITE_DIR"
        FAILED=1
    else
        echo "✅ Site directory removed"
    fi
else
    echo "ℹ️  No site directory found"
fi

# 3. Remove from Caddyfile
echo "Removing from Caddyfile..."
if grep -q "^${DOMAIN} {" "$CADDYFILE"; then
    # Remove the domain block (domain { ... })
    if ! sed -i "/^${DOMAIN} {/,/^}/d" "$CADDYFILE"; then
        echo "⚠️  Failed to remove from Caddyfile"
        FAILED=1
    else
        echo "✅ Removed from Caddyfile"
    fi
else
    echo "ℹ️  Domain not found in Caddyfile"
fi

# 4. Reload Caddy
echo "Reloading Caddy..."
if ! systemctl reload caddy; then
    echo "⚠️  Failed to reload Caddy"
    FAILED=1
else
    echo "✅ Caddy reloaded"
fi

# 5. Remove from domain-passwords.json (only if everything else succeeded)
if [ $FAILED -eq 0 ]; then
    echo "Removing from domain-passwords.json..."
    if ! jq --arg domain "$DOMAIN" 'del(.[$domain])' "$DOMAIN_PASSWORDS_FILE" > "${DOMAIN_PASSWORDS_FILE}.tmp"; then
        echo "⚠️  Failed to remove from domain-passwords.json"
        FAILED=1
    else
        mv "${DOMAIN_PASSWORDS_FILE}.tmp" "$DOMAIN_PASSWORDS_FILE"
        echo "✅ Removed from domain-passwords.json"
    fi
else
    echo "⚠️  Skipping removal from domain-passwords.json due to previous failures"
fi

# 6. Optionally remove system user (commented out for safety)
# echo "Removing system user: $USER"
# if id "$USER" &>/dev/null; then
#     userdel "$USER" || echo "⚠️  Failed to remove user $USER (may still own files)"
# fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ Successfully deleted $DOMAIN"
    exit 0
else
    echo "⚠️  Deletion completed with errors for $DOMAIN"
    exit 1
fi
