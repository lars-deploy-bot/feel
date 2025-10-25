#!/bin/bash

# Automated Website Deployment Script
# Usage: ./deploy-site.sh domain.com

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 domain.com"
    echo "Example: $0 newsite.com"
    echo ""
    echo "Requirements:"
    echo "- Domain must have an A record pointing to 138.201.56.93"
    echo "- Subdomains are supported if they point to our server"
    exit 2  # Invalid arguments
fi

DOMAIN=$1
SITES_DIR="/root/webalive/sites"
SITE_DIR="$SITES_DIR/$DOMAIN"
CADDYFILE="/root/webalive/claude-bridge/Caddyfile"
SERVER_IP="138.201.56.93"

echo "🚀 Deploying $DOMAIN..."

# 0. Validate DNS pointing to our server
echo "🔍 Validating DNS for $DOMAIN..."
DOMAIN_IP=$(dig +short "$DOMAIN" A | tail -n1)

if [ -z "$DOMAIN_IP" ]; then
    echo "❌ DNS Error: No A record found for $DOMAIN"
    echo "   Please ensure $DOMAIN has an A record pointing to $SERVER_IP"
    exit 11  # DNS validation failed
fi

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo "❌ DNS Error: $DOMAIN points to $DOMAIN_IP, but should point to $SERVER_IP"
    echo "   Please update the A record for $DOMAIN to point to $SERVER_IP"
    echo "   Current DNS: $DOMAIN → $DOMAIN_IP"
    echo "   Required DNS: $DOMAIN → $SERVER_IP"
    exit 11  # DNS validation failed
fi

echo "✅ DNS validation passed: $DOMAIN → $SERVER_IP"

# 1. Check if site directory exists
if [ -d "$SITE_DIR" ]; then
    echo "❌ Site directory already exists at: $SITE_DIR"
    echo "   To redeploy an existing site, use the update commands instead"
    echo "   Or remove the directory first: rm -rf $SITE_DIR"
    exit 10  # Site already exists
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
    echo "⚠️  No config generator found, using manual updates..."
    # Fallback to manual updates
    PACKAGE_JSON="$SITE_DIR/user/package.json"
    if [ -f "$PACKAGE_JSON" ]; then
        SAFE_NAME=$(echo "$DOMAIN" | sed 's/\./_/g')
        sed -i "s/\"name\": \".*\"/\"name\": \"$SAFE_NAME\"/" "$PACKAGE_JSON"
    fi
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

# 4. Generate or update configuration files
echo "⚙️  Updating configuration files..."
if [ -f "$SITE_DIR/scripts/generate-config.js" ]; then
    echo "🔧 Using config generator..."
    cd "$SITE_DIR"
    bun run scripts/generate-config.js "$DOMAIN" "$PORT"
else
    echo "⚠️  No config generator found, using manual updates..."
    # Fallback to manual updates for existing sites
    VITE_CONFIG="$SITE_DIR/user/vite.config.ts"
    if [ -f "$VITE_CONFIG" ]; then
        sed -i "s/port: [0-9]*/port: $PORT/g" "$VITE_CONFIG"
        sed -i "s/allowedHosts: \\[.*\\]/allowedHosts: [\"$DOMAIN\"]/g" "$VITE_CONFIG"
    fi
fi

# 5. Install dependencies and build
echo "📦 Installing dependencies..."
cd "$SITE_DIR/user"
bun install

echo "🔨 Building project..."
bun run build

# 6. Ensure ecosystem config is updated (if config generator wasn't used)
if [ ! -f "$SITE_DIR/scripts/generate-config.js" ]; then
    ECOSYSTEM_CONFIG="$SITE_DIR/ecosystem.config.js"
    if [ -f "$ECOSYSTEM_CONFIG" ]; then
        PM2_NAME=$(echo "$DOMAIN" | sed 's/\./-/g')
        sed -i "s/name: '.*'/name: '$PM2_NAME'/" "$ECOSYSTEM_CONFIG"
        sed -i "s/PORT: [0-9]*/PORT: $PORT/" "$ECOSYSTEM_CONFIG"
        sed -i "s/--port [0-9]*/--port $PORT/" "$ECOSYSTEM_CONFIG"
    fi
fi

# 7. Stop existing PM2 process if it exists
PM2_NAME=$(echo "$DOMAIN" | sed 's/\./-/g')
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    echo "🔄 Stopping existing PM2 process..."
    pm2 delete "$PM2_NAME"
fi

# 8. Start new PM2 process
echo "🚀 Starting PM2 process..."
if [ -f "$ECOSYSTEM_CONFIG" ]; then
    pm2 start "$ECOSYSTEM_CONFIG"
else
    pm2 start "bun run dev --port $PORT --host 0.0.0.0" --name "$PM2_NAME" --cwd "$SITE_DIR/user"
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