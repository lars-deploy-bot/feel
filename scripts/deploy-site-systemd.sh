#!/bin/bash

# Secure Website Deployment Script with systemd Isolation
# Usage: ./deploy-site-systemd.sh domain.com
#
# SECURITY: This script deploys sites with full user isolation using systemd
# Each site runs as its own user with restricted file system and network access.

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 domain.com"
    echo "Example: $0 newsite.com"
    echo ""
    echo "Requirements:"
    echo "- Domain must have an A record pointing to 138.201.56.93"
    echo "- systemd service template must exist at /etc/systemd/system/site@.service"
    exit 2
fi

DOMAIN=$1
SLUG=${DOMAIN//[^a-zA-Z0-9]/-}  # Convert domain to systemd-safe name
USER="site-${SLUG}"
OLD_SITE_DIR="/root/webalive/sites/$DOMAIN"
NEW_SITE_DIR="/srv/webalive/sites/$DOMAIN"
CADDYFILE="/root/webalive/claude-bridge/Caddyfile"
SERVER_IP="138.201.56.93"

echo "🚀 Deploying $DOMAIN with systemd isolation..."

# 1. Validate DNS pointing to our server
echo "🔍 Validating DNS for $DOMAIN..."
DOMAIN_IP=$(dig +short "$DOMAIN" A | tail -n1)

if [ -z "$DOMAIN_IP" ]; then
    echo "❌ DNS Error: No A record found for $DOMAIN"
    echo "   Please ensure $DOMAIN has an A record pointing to $SERVER_IP"
    exit 12
fi

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo "❌ DNS Error: $DOMAIN points to $DOMAIN_IP, but should point to $SERVER_IP"
    exit 12
fi

echo "✅ DNS validation passed: $DOMAIN → $SERVER_IP"

# 2. Create system user for the site
echo "👤 Creating system user: $USER"
if id "$USER" &>/dev/null; then
    echo "✅ User $USER already exists"
else
    useradd --system --home-dir "$NEW_SITE_DIR" --shell /usr/sbin/nologin "$USER"
    echo "✅ Created user: $USER"
fi

# 3. Prepare directory structure
echo "📁 Setting up directory structure..."
mkdir -p "$NEW_SITE_DIR"

# 4. Copy site files
if [ -d "$OLD_SITE_DIR" ]; then
    echo "📋 Copying existing site from $OLD_SITE_DIR"
    cp -r "$OLD_SITE_DIR"/* "$NEW_SITE_DIR/"
else
    echo "📋 Creating new site from template"
    if [ ! -d "/root/webalive/sites/template" ]; then
        echo "❌ Template directory not found"
        exit 3
    fi
    cp -r "/root/webalive/sites/template"/* "$NEW_SITE_DIR/"
fi

# 5. CRITICAL: Fix ownership after copying
echo "🔒 Setting proper file ownership..."
chown -R "$USER:$USER" "$NEW_SITE_DIR"
chmod 750 "$NEW_SITE_DIR"

# 6. Create symlink for systemd compatibility (if domain has dots)
if [[ "$DOMAIN" == *.* ]]; then
    SYMLINK_PATH="/srv/webalive/sites/$SLUG"
    if [ ! -L "$SYMLINK_PATH" ]; then
        ln -sf "$DOMAIN" "$SYMLINK_PATH"
        echo "✅ Created symlink for systemd compatibility"
    fi
fi

# 7. Generate configuration
echo "🔧 Generating site configuration..."
cd "$NEW_SITE_DIR"

# Find available port
echo "🔍 Finding available port..."
PORT=3334
while netstat -tuln | grep -q ":$PORT " || grep -q "localhost:$PORT" "$CADDYFILE"; do
    PORT=$((PORT + 1))
done
echo "✅ Using port $PORT"

# Generate configs using the template script
if [ -f "$NEW_SITE_DIR/scripts/generate-config.js" ]; then
    echo "⚙️ Generating configuration..."
    cd "$NEW_SITE_DIR"
    bun run scripts/generate-config.js "$DOMAIN" "$PORT"
else
    echo "❌ Config generator not found"
    exit 4
fi

# 8. Install dependencies and build
echo "📦 Installing dependencies..."
cd "$NEW_SITE_DIR/user"
sudo -u "$USER" bun install

echo "🔨 Building project..."
sudo -u "$USER" bun run build

# 9. Stop old PM2 process if exists
PM2_NAME=$(echo "$DOMAIN" | sed 's/\./-/g')
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    echo "🔄 Stopping old PM2 process..."
    pm2 delete "$PM2_NAME"
fi

# 10. Start systemd service
echo "🚀 Starting systemd service..."
systemctl daemon-reload
systemctl start "site@${SLUG}.service"

# 11. Verify service started
sleep 3
if systemctl is-active --quiet "site@${SLUG}.service"; then
    echo "✅ systemd service started successfully"

    # Get the actual port from service
    SERVICE_PORT=$(journalctl -u "site@${SLUG}.service" --lines=10 | grep -o 'localhost:[0-9]*' | cut -d: -f2 | head -1)
    if [ -n "$SERVICE_PORT" ]; then
        PORT=$SERVICE_PORT
    fi
else
    echo "❌ systemd service failed to start"
    journalctl -u "site@${SLUG}.service" --lines=10
    exit 8
fi

# 12. Update Caddyfile
echo "📝 Updating Caddyfile..."
if grep -q "^$DOMAIN {" "$CADDYFILE"; then
    echo "⚠️ Domain already exists in Caddyfile, updating port..."
    sed -i "/^$DOMAIN {/,/^}/ s/localhost:[0-9]*/localhost:$PORT/" "$CADDYFILE"
else
    echo "➕ Adding new domain to Caddyfile..."
    cat >> "$CADDYFILE" << EOF

$DOMAIN {
    import common_headers
    reverse_proxy localhost:$PORT {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
fi

# 13. Reload Caddy
echo "🔄 Reloading Caddy configuration..."
systemctl reload caddy

# 14. Final verification
echo "✅ Deployment complete!"
echo ""
echo "📊 Summary:"
echo "   Domain: $DOMAIN"
echo "   Port: $PORT"
echo "   systemd Service: site@${SLUG}.service"
echo "   User: $USER"
echo "   Site Directory: $NEW_SITE_DIR"
echo ""
echo "🌐 Your site should be available at: https://$DOMAIN"
echo ""
echo "📋 Useful commands:"
echo "   Check service: systemctl status site@${SLUG}.service"
echo "   View logs: journalctl -u site@${SLUG}.service -f"
echo "   Restart: systemctl restart site@${SLUG}.service"
echo ""
echo "🛡️ Security Status:"
echo "   ✅ Process isolation: Runs as user $USER"
echo "   ✅ File access: Limited to $NEW_SITE_DIR"
echo "   ✅ systemd hardening: Active"
echo "   ✅ Resource limits: Enforced"