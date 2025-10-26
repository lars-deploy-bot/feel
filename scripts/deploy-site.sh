#!/bin/bash

# ⚠️ DEPRECATED: INSECURE PM2 DEPLOYMENT SCRIPT
#
# This script deploys sites using PM2 running as ROOT, which is a SECURITY RISK.
#
# 🔒 USE SECURE ALTERNATIVE: /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh
#
# The systemd deployment provides:
# - Process isolation (dedicated user per site)
# - File system restrictions
# - Resource limits and security hardening
# - systemd sandboxing
#
# This PM2 script is maintained for legacy compatibility only.
#
# Automated Website Deployment Script
# Usage: ./deploy-site.sh domain.com
#
# SECURITY: This script has been hardened to prevent PM2 bash crash loops
# that can crash the entire terminal system. All ecosystem configs are
# validated to use 'bun' and never 'bash' to prevent system-wide outages.
#
# Emergency fix available at: ./fix-bash-crash-loops.sh

set -e

if [ $# -eq 0 ]; then
    echo "🚨 CRITICAL SECURITY WARNING 🚨"
    echo "This script is DEPRECATED and INSECURE (runs as root)"
    echo ""
    echo "🔒 MANDATORY: Use secure deployment instead:"
    echo "   /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh domain.com"
    echo ""
    echo "⚠️ This insecure script will be removed in future versions"
    echo "⚠️ New deployments should NEVER use PM2 as root"
    echo ""
    echo "Legacy usage (NOT RECOMMENDED): $0 domain.com"
    echo ""
    exit 2  # Invalid arguments
fi

DOMAIN=$1
SITES_DIR="/root/webalive/sites"
SITE_DIR="$SITES_DIR/$DOMAIN"
CADDYFILE="/root/webalive/claude-bridge/Caddyfile"
SERVER_IP="138.201.56.93"

echo ""
echo "🚨🚨🚨 CRITICAL SECURITY WARNING 🚨🚨🚨"
echo "DEPLOYING $DOMAIN WITH INSECURE PM2 (RUNS AS ROOT)"
echo ""
echo "🔒 YOU SHOULD STOP AND USE:"
echo "   /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh $DOMAIN"
echo ""
echo "⚠️ This creates MAJOR SECURITY VULNERABILITIES"
echo "⚠️ Site will have access to ALL server files"
echo "⚠️ No process isolation or resource limits"
echo ""
echo "Press Ctrl+C within 10 seconds to abort..."
sleep 10
echo ""
echo "🚀 Proceeding with INSECURE deployment..."

# 0. Validate DNS pointing to our server
echo "🔍 Validating DNS for $DOMAIN..."
DOMAIN_IP=$(dig +short "$DOMAIN" A | tail -n1)

if [ -z "$DOMAIN_IP" ]; then
    echo "❌ DNS Error: No A record found for $DOMAIN"
    echo "   Please ensure $DOMAIN has an A record pointing to $SERVER_IP"
    exit 12  # DNS validation failed
fi

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo "❌ DNS Error: $DOMAIN points to $DOMAIN_IP, but should point to $SERVER_IP"
    echo "   Please update the A record for $DOMAIN to point to $SERVER_IP"
    echo "   Current DNS: $DOMAIN → $DOMAIN_IP"
    echo "   Required DNS: $DOMAIN → $SERVER_IP"
    exit 12  # DNS validation failed
fi

echo "✅ DNS validation passed: $DOMAIN → $SERVER_IP"

# 1. Check if site directory exists
if [ -d "$SITE_DIR" ]; then
    echo "❌ Site directory already exists at: $SITE_DIR"
    echo "   To redeploy an existing site, use the update commands instead"
    echo "   Or remove the directory first: rm -rf $SITE_DIR"
    exit 11  # Site already exists
else
    echo "📋 Site directory doesn't exist, creating from template..."
    if [ ! -d "$SITES_DIR/template" ]; then
        echo "❌ Template directory not found at $SITES_DIR/template"
        exit 3  # Missing template
    fi

    cp -r "$SITES_DIR/template" "$SITE_DIR"
    echo "✅ Site created from template"
fi

# 3. Find available port (starting from 3334)
echo "🔍 Finding available port..."
PORT=3334

# Get all ports currently assigned in Caddyfile
ASSIGNED_PORTS=$(grep -o 'localhost:[0-9]*' "$CADDYFILE" | cut -d: -f2 | sort -n)

while true; do
    # Check if port is actively in use
    if netstat -tuln | grep -q ":$PORT "; then
        PORT=$((PORT + 1))
        continue
    fi

    # Check if port is assigned in Caddyfile
    if echo "$ASSIGNED_PORTS" | grep -q "^$PORT$"; then
        PORT=$((PORT + 1))
        continue
    fi

    # Port is available
    break
done
echo "✅ Using port $PORT"

# 2. Generate configuration files for new site
echo "🔧 Configuring site for $DOMAIN on port $PORT..."
if [ -f "$SITE_DIR/scripts/generate-config.js" ]; then
    echo "⚙️  Using config generator..."
    cd "$SITE_DIR"
    bun run scripts/generate-config.js "$DOMAIN" "$PORT"
else
    echo "❌ Config generator not found at $SITE_DIR/scripts/generate-config.js"
    echo "   This is required for proper PM2 configuration"
    exit 4  # Missing config generator
fi

# 4. Update Caddyfile
echo "📝 Updating Caddyfile..."
if grep -q "^$DOMAIN {" "$CADDYFILE"; then
    echo "⚠️  Domain already exists in Caddyfile, updating port..."
    sed -i "/^$DOMAIN {/,/^}/ s/localhost:[0-9]*/localhost:$PORT/" "$CADDYFILE"
else
    echo "➕ Adding new domain to Caddyfile..."
    cat >> "$CADDYFILE" << EOF

$DOMAIN {
    reverse_proxy localhost:$PORT
}
EOF
fi

# Configuration files are already generated above - this duplicate section is removed

# 5. Install dependencies and build
echo "📦 Installing dependencies..."
cd "$SITE_DIR/user"
bun install

echo "🔨 Building project..."
bun run build

# 6. Verify ecosystem config was generated properly
ECOSYSTEM_CONFIG="$SITE_DIR/ecosystem.config.js"
if [ ! -f "$ECOSYSTEM_CONFIG" ]; then
    echo "❌ ecosystem.config.js not found after generation"
    echo "   Expected at: $ECOSYSTEM_CONFIG"
    exit 5  # Config generation failed
fi

# 6.1. Validate ecosystem config content
echo "🔍 Validating ecosystem config content..."
if ! grep -q "script: 'bun'" "$ECOSYSTEM_CONFIG"; then
    echo "❌ ecosystem.config.js does not contain 'script: bun'"
    echo "   This would cause PM2 to crash in a loop"
    echo "   Config file content:"
    cat "$ECOSYSTEM_CONFIG"
    exit 6  # Invalid config content
fi

if grep -q "/usr/bin/bash" "$ECOSYSTEM_CONFIG"; then
    echo "❌ ecosystem.config.js contains bash references"
    echo "   This would cause PM2 crash loops and terminal errors"
    echo "   Config file content:"
    cat "$ECOSYSTEM_CONFIG"
    exit 7  # Dangerous config content
fi

echo "✅ Ecosystem config validated - using bun correctly"

# 7. Stop existing PM2 process if it exists
PM2_NAME=$(echo "$DOMAIN" | sed 's/\./-/g')
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    echo "🔄 Stopping existing PM2 process..."
    pm2 delete "$PM2_NAME"
fi

# 8. Start new PM2 process using verified ecosystem config
echo "🚀 Starting PM2 process..."
cd "$SITE_DIR"  # Ensure we're in the correct directory for PM2
pm2 start "$ECOSYSTEM_CONFIG"

# 8.1. Verify PM2 process started correctly
echo "🔍 Verifying PM2 process started correctly..."
sleep 3  # Give PM2 time to start

if ! pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    echo "❌ PM2 process $PM2_NAME failed to start"
    exit 8  # PM2 start failed
fi

# Check if process is actually online (not crashed)
PM2_INFO=$(pm2 show "$PM2_NAME")
if echo "$PM2_INFO" | grep -q "status.*errored\|status.*stopped"; then
    echo "❌ PM2 process $PM2_NAME failed to start properly"
    echo "   Checking logs for errors..."
    pm2 logs "$PM2_NAME" --lines 20
    exit 9  # PM2 process not online
fi

if ! echo "$PM2_INFO" | grep -q "status.*online"; then
    echo "❌ PM2 process $PM2_NAME is not online"
    echo "   Process info:"
    echo "$PM2_INFO" | head -20
    exit 9  # PM2 process not online
fi

# Verify the process is using bun, not bash
if echo "$PM2_INFO" | grep -q "script path.*bash"; then
    echo "❌ PM2 process $PM2_NAME is incorrectly using bash instead of bun"
    echo "   Process info:"
    echo "$PM2_INFO" | grep "script path"
    pm2 delete "$PM2_NAME"
    exit 10  # Wrong interpreter
fi

echo "✅ PM2 process $PM2_NAME started successfully with bun"

# 8.2. Final health check - test if service responds
echo "🏥 Performing final health check..."
sleep 2  # Give service time to initialize
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" | grep -q "200\|404"; then
    echo "✅ Service responding on port $PORT"
else
    echo "⚠️  Service not responding on port $PORT (this may be normal during initial startup)"
fi

# 8. Reload Caddy
echo "🔄 Reloading Caddy configuration..."
caddy reload --config "$CADDYFILE"

# 9. Verify deployment
echo "✅ Deployment complete!"
echo ""
echo "📊 Summary:"
echo "   Domain: $DOMAIN"
echo "   Port: $PORT"
echo "   PM2 Process: $PM2_NAME"
echo "   Site Directory: $SITE_DIR"
echo ""
echo "🌐 Your site should be available at: https://$DOMAIN"
echo ""
echo "📋 Useful commands:"
echo "   Check PM2 status: pm2 list"
echo "   View logs: pm2 logs $PM2_NAME"
echo "   Restart: pm2 restart $PM2_NAME"
echo "   Test locally: curl -I http://localhost:$PORT"