#!/bin/bash

# WebAlive Site Removal Script
# Usage: ./remove-site.sh domain.com

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 domain.com"
    echo "Example: $0 larsvandeneeden.com"
    echo ""
    echo "This will completely remove the site from WebAlive infrastructure:"
    echo "- Stop systemd service"
    echo "- Remove from domain registry"
    echo "- Remove from Caddyfile"
    echo "- Remove system user"
    echo "- Remove environment file"
    echo "- Remove site directory"
    echo "- Reload Caddy"
    exit 1
fi

DOMAIN=$1
SLUG=${DOMAIN//[^a-zA-Z0-9]/-}  # Convert domain to systemd-safe name
USER="site-${SLUG}"
SITE_DIR="/srv/webalive/sites/$DOMAIN"
CADDYFILE="/root/webalive/claude-bridge/Caddyfile"
DOMAIN_PASSWORDS_FILE="/var/lib/claude-bridge/domain-passwords.json"
ENV_FILE="/etc/sites/${SLUG}.env"

echo "🗑️  Removing $DOMAIN from WebAlive infrastructure..."

# 1. Stop systemd service
echo "⏹️  Stopping systemd service..."
if systemctl is-active --quiet "site@${SLUG}.service" 2>/dev/null; then
    systemctl stop "site@${SLUG}.service"
    echo "✅ Stopped site@${SLUG}.service"
else
    echo "ℹ️  Service site@${SLUG}.service was not running"
fi

# 2. Remove from domain registry
echo "📝 Removing from domain registry..."
if [ -f "$DOMAIN_PASSWORDS_FILE" ] && jq -e ".[\"$DOMAIN\"]" "$DOMAIN_PASSWORDS_FILE" > /dev/null 2>&1; then
    jq "del(.[\"$DOMAIN\"])" "$DOMAIN_PASSWORDS_FILE" > "${DOMAIN_PASSWORDS_FILE}.tmp"
    mv "${DOMAIN_PASSWORDS_FILE}.tmp" "$DOMAIN_PASSWORDS_FILE"
    echo "✅ Removed $DOMAIN from domain-passwords.json"
else
    echo "ℹ️  Domain $DOMAIN not found in registry"
fi

# 3. Remove from Caddyfile
echo "🌐 Removing from Caddyfile..."
if grep -q "^$DOMAIN {" "$CADDYFILE" 2>/dev/null; then
    # Remove the entire domain block (from "domain {" to the matching "}")
    sed -i "/^$DOMAIN {/,/^}/d" "$CADDYFILE"

    # Clean up any double empty lines
    sed -i '/^$/N;/^\n$/d' "$CADDYFILE"

    echo "✅ Removed $DOMAIN from Caddyfile"
else
    echo "ℹ️  Domain $DOMAIN not found in Caddyfile"
fi

# 4. Remove system user
echo "👤 Removing system user..."
if id "$USER" &>/dev/null; then
    userdel "$USER"
    echo "✅ Removed user $USER"
else
    echo "ℹ️  User $USER does not exist"
fi

# 5. Remove environment file
echo "⚙️  Removing environment file..."
if [ -f "$ENV_FILE" ]; then
    rm -f "$ENV_FILE"
    echo "✅ Removed $ENV_FILE"
else
    echo "ℹ️  Environment file $ENV_FILE does not exist"
fi

# 6. Remove site directory
echo "📁 Removing site directory..."
if [ -d "$SITE_DIR" ]; then
    rm -rf "$SITE_DIR"
    echo "✅ Removed $SITE_DIR"
else
    echo "ℹ️  Site directory $SITE_DIR does not exist"
fi

# 7. Reload Caddy configuration
echo "🔄 Reloading Caddy configuration..."
if systemctl reload caddy; then
    echo "✅ Caddy configuration reloaded"
else
    echo "⚠️  Failed to reload Caddy (check systemctl status caddy)"
fi

# 8. Verification
echo ""
echo "🧪 Verification:"

# Check service
if systemctl list-units --all | grep -q "site@${SLUG}.service"; then
    echo "⚠️  systemd service still exists (this is normal - unit files remain)"
else
    echo "✅ systemd service removed"
fi

# Check user
if id "$USER" &>/dev/null; then
    echo "❌ User $USER still exists"
else
    echo "✅ User $USER removed"
fi

# Check environment file
if [ -f "$ENV_FILE" ]; then
    echo "❌ Environment file still exists"
else
    echo "✅ Environment file removed"
fi

# Check site directory
if [ -d "$SITE_DIR" ]; then
    echo "❌ Site directory still exists"
else
    echo "✅ Site directory removed"
fi

# Check domain registry
if [ -f "$DOMAIN_PASSWORDS_FILE" ] && jq -e ".[\"$DOMAIN\"]" "$DOMAIN_PASSWORDS_FILE" > /dev/null 2>&1; then
    echo "❌ Domain still in registry"
else
    echo "✅ Domain removed from registry"
fi

# Check Caddyfile
if grep -q "^$DOMAIN {" "$CADDYFILE" 2>/dev/null; then
    echo "❌ Domain still in Caddyfile"
else
    echo "✅ Domain removed from Caddyfile"
fi

echo ""
echo "🎉 Site removal complete!"
echo ""
echo "📊 Summary:"
echo "   Domain: $DOMAIN"
echo "   systemd Service: site@${SLUG}.service (stopped)"
echo "   User: $USER (removed)"
echo "   Site Directory: $SITE_DIR (removed)"
echo "   Environment File: $ENV_FILE (removed)"
echo ""
echo "ℹ️  The domain is now available for redeployment if needed."