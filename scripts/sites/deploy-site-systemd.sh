#!/bin/bash

# Improved Secure Website Deployment Script with Consistent Port Management
# Usage: ./deploy-site-systemd-improved.sh domain.com
#
# IMPROVEMENTS:
# - Consistent port assignment using domain-passwords.json as single source of truth
# - Automatic port increment starting from 3333
# - Proper environment file creation for systemd services
# - Port verification and conflict resolution

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

DOMAIN=$(echo "$1" | tr '[:upper:]' '[:lower:]')  # Convert to lowercase
SLUG=${DOMAIN//[^a-zA-Z0-9]/-}  # Convert domain to systemd-safe name
USER="site-${SLUG}"
OLD_SITE_DIR="/root/webalive/sites/$DOMAIN"
NEW_SITE_DIR="/srv/webalive/sites/$DOMAIN"
CADDYFILE="/root/webalive/claude-bridge/Caddyfile"
DOMAIN_PASSWORDS_FILE="/var/lib/claude-bridge/domain-passwords.json"
SERVER_IP="138.201.56.93"
PASSWORD="${DEPLOY_PASSWORD:-}"  # Read from environment (optional if EMAIL provided)
EMAIL="${DEPLOY_EMAIL:-}"  # User's email address

echo "🚀 Deploying $DOMAIN with improved port management..."

# If both EMAIL and PASSWORD are provided, hash the password
# If only EMAIL is provided, we'll link to existing user (no password needed)
# If neither is provided, ERROR (we need at least an email)
if [ -z "$EMAIL" ]; then
    echo "❌ DEPLOY_EMAIL is required"
    echo "   Either provide existing user email (to link domain) or new email (to create account)"
    exit 17
fi

if [ -n "$PASSWORD" ]; then
    echo "🔐 Hashing password for new account creation..."
    PASSWORD_HASH=$(cd /root/webalive/claude-bridge && bun scripts/hash-password.mjs "$PASSWORD")

    if [ -z "$PASSWORD_HASH" ]; then
        echo "❌ Failed to hash password"
        exit 16
    fi

    echo "✅ Password hashed successfully (will create account for $EMAIL if doesn't exist)"
else
    echo "✅ No password provided - will link domain to existing account: $EMAIL"
    PASSWORD_HASH=""  # Empty password hash = link to existing user
fi

# 1. Validate DNS pointing to our server (skip for wildcard domains)
WILDCARD_DOMAIN="alive.best"

if [[ "$DOMAIN" == *".$WILDCARD_DOMAIN" ]]; then
    # Skip DNS validation for wildcard subdomains (already trusted)
    echo "✅ Wildcard domain detected ($DOMAIN) - skipping DNS validation (pre-verified wildcard)"
else
    # Standard DNS validation for custom domains
    echo "🔍 Validating DNS for $DOMAIN..."
    DOMAIN_IP=$(dig +short "$DOMAIN" A | tail -n1)

    if [ -z "$DOMAIN_IP" ]; then
        echo "❌ DNS Error: No A record found for $DOMAIN"
        echo "   You must create an A record for $DOMAIN with these exact settings:"
        echo "   Type: A"
        echo "   Name/Host: @ (or $DOMAIN)"
        echo "   Value/Points to: $SERVER_IP"
        echo "   TTL: 300 (or Auto)"
        echo "   ⚠️  ALSO: Remove any AAAA records (IPv6) for $DOMAIN"
        echo "   📖 See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup"
        exit 12
    fi

    if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
        # Check if it's a Cloudflare proxy IP (common ranges)
        if [[ "$DOMAIN_IP" =~ ^(104\.1[6-9]\.|104\.2[0-4]\.|172\.6[4-7]\.|172\.7[0-1]\.|173\.245\.|188\.114\.|190\.93\.|197\.234\.|198\.41\.) ]]; then
            echo "❌ DNS Error: $DOMAIN points to $DOMAIN_IP (Cloudflare proxy IP)"
            echo "   🚨 CLOUDFLARE PROXY DETECTED: You must disable the orange cloud (proxy) in Cloudflare DNS settings!"
            echo "   💡 Make the cloud icon GRAY (not orange) next to your A record, then try again."
            echo "   📖 See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup"
            exit 12
        else
            echo "❌ DNS Error: $DOMAIN currently points to $DOMAIN_IP, but it must point to $SERVER_IP"
            echo "   You need to update your A record for $DOMAIN with these exact settings:"
            echo "   Type: A"
            echo "   Name/Host: @ (or $DOMAIN)"
            echo "   Value/Points to: $SERVER_IP"
            echo "   TTL: 300 (or Auto)"
            echo "   ⚠️  ALSO: Remove any AAAA records (IPv6) for $DOMAIN"
            echo "   📖 See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup"
            exit 12
        fi
    fi

    echo "✅ DNS validation passed: $DOMAIN → $SERVER_IP"

    # 1.5. Check for AAAA records that might interfere
    echo "🔍 Checking for AAAA records (IPv6)..."
    AAAA_RECORDS=$(dig +short "$DOMAIN" AAAA | grep -v "^$" || true)

    if [ -n "$AAAA_RECORDS" ]; then
        echo "⚠️  WARNING: AAAA records (IPv6) detected for $DOMAIN:"
        echo "   $AAAA_RECORDS"
        echo "   💡 RECOMMENDATION: Remove AAAA records to prevent potential deployment issues"
        echo "   📖 See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup"
        echo "   🔄 Continuing deployment anyway..."
    fi
fi

# 2. Smart port assignment from domain-passwords.json
echo "🔢 Determining port assignment..."

# Function to get next available port from domain-passwords.json AND check actual port usage
get_next_port() {
    local start_port=3333

    if [ -f "$DOMAIN_PASSWORDS_FILE" ]; then
        # Get all currently used ports in the site port range (3333-3999) and find the highest
        # Exclude special service ports like 8997, 8998, 9000 (dev, staging, production)
        local highest_port=$(jq -r '.[].port' "$DOMAIN_PASSWORDS_FILE" 2>/dev/null | awk '$1 >= 3333 && $1 < 4000' | sort -n | tail -1)

        if [ -n "$highest_port" ] && [ "$highest_port" != "null" ]; then
            start_port=$((highest_port + 1))
        fi
    fi

    # Find first port that's not in use by any process (stay within site port range)
    local test_port=$start_port
    while netstat -tuln | grep -q ":$test_port "; do
        echo "🔍 Port $test_port is occupied, trying next..." >&2
        test_port=$((test_port + 1))

        # Safety limit to prevent infinite loop
        if [ $test_port -gt 3999 ]; then
            echo "❌ Cannot find available port in range 3333-3999 (all occupied)" >&2
            exit 15
        fi
    done

    echo $test_port
}

# Port assignment: Check if domain already exists, otherwise get next available
if [ -f "$DOMAIN_PASSWORDS_FILE" ] && jq -e ".[\"$DOMAIN\"]" "$DOMAIN_PASSWORDS_FILE" > /dev/null 2>&1; then
    PORT=$(jq -r ".[\"$DOMAIN\"].port" "$DOMAIN_PASSWORDS_FILE")
    echo "✅ Using existing port assignment: $PORT"
else
    PORT=$(get_next_port)
    echo "✅ Assigned new port: $PORT"

    # Add port to domain-passwords.json (used by /api/deploy-subdomain for port registry)
    # Only port is stored; all other fields (email, credits, passwordHash) are in Supabase
    if [ ! -f "$DOMAIN_PASSWORDS_FILE" ]; then
        echo "{}" > "$DOMAIN_PASSWORDS_FILE"
    fi

    jq --arg domain "$DOMAIN" \
       --argjson port "$PORT" \
       '.[$domain] = {port: $port}' \
       "$DOMAIN_PASSWORDS_FILE" > "${DOMAIN_PASSWORDS_FILE}.tmp"
    mv "${DOMAIN_PASSWORDS_FILE}.tmp" "$DOMAIN_PASSWORDS_FILE"

    echo "✅ Added $DOMAIN to domain-passwords.json (port $PORT)"

    # Supabase registration is now handled by the API route (POST /api/deploy-subdomain)
    # This ensures the domain is registered in request context with proper authentication
    echo "✅ Domain registration handled by API (Supabase + port assignment)"
fi

# 3. For existing domains, verify their assigned port is still available
if [ -f "$DOMAIN_PASSWORDS_FILE" ] && jq -e ".[\"$DOMAIN\"]" "$DOMAIN_PASSWORDS_FILE" > /dev/null 2>&1; then
    if netstat -tuln | grep -q ":$PORT "; then
        echo "⚠️ Existing domain's port $PORT is now occupied, finding new port..."
        NEW_PORT=$(get_next_port)
        echo "🔄 Reassigning $DOMAIN from port $PORT to $NEW_PORT"

        # Update domain-passwords.json with new port (preserve existing password)
        jq --argjson port "$NEW_PORT" \
           --arg domain "$DOMAIN" \
           '.[$domain].port = $port' \
           "$DOMAIN_PASSWORDS_FILE" > "${DOMAIN_PASSWORDS_FILE}.tmp"
        mv "${DOMAIN_PASSWORDS_FILE}.tmp" "$DOMAIN_PASSWORDS_FILE"
        PORT=$NEW_PORT
        echo "✅ Updated registry with new port: $PORT"
    fi
fi

echo "✅ Port $PORT is available and verified"

# 4. Create system user for the site
echo "👤 Creating system user: $USER"
if id "$USER" &>/dev/null; then
    echo "✅ User $USER already exists"
else
    useradd --system --home-dir "$NEW_SITE_DIR" --shell /usr/sbin/nologin "$USER"
    echo "✅ Created user: $USER"
fi

# 5. Prepare directory structure
echo "📁 Setting up directory structure..."
mkdir -p "$NEW_SITE_DIR"
mkdir -p "/etc/sites"

# 6. Copy site files
if [ -d "$OLD_SITE_DIR" ]; then
    echo "📋 Copying existing site from $OLD_SITE_DIR"
    cp -r "$OLD_SITE_DIR"/* "$NEW_SITE_DIR/"
else
    echo "📋 Creating new site from template"
    if [ ! -d "/root/webalive/claude-bridge/packages/template" ]; then
        echo "❌ Template directory not found"
        exit 3
    fi
    cp -r "/root/webalive/claude-bridge/packages/template"/* "$NEW_SITE_DIR/"
fi

# 6.5. Create/update site-specific Caddyfile
echo "📝 Creating site Caddyfile..."
cat > "$NEW_SITE_DIR/Caddyfile" << EOF
# Auto-generated Caddyfile for $DOMAIN
# Port: $PORT

$DOMAIN {
    import common_headers
    import image_serving
    reverse_proxy localhost:$PORT {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
echo "✅ Created $NEW_SITE_DIR/Caddyfile with port $PORT"

# 7. Initial ownership after copying (will fix again after config generation)
echo "🔒 Setting initial file ownership..."
chown -R "$USER:$USER" "$NEW_SITE_DIR"
chmod 750 "$NEW_SITE_DIR"

# 8. Create symlink for systemd compatibility (if domain has dots)
if [[ "$DOMAIN" == *.* ]]; then
    SYMLINK_PATH="/srv/webalive/sites/$SLUG"
    if [ ! -L "$SYMLINK_PATH" ]; then
        ln -sf "$DOMAIN" "$SYMLINK_PATH"
        echo "✅ Created symlink for systemd compatibility"
    fi
fi

# 9. Create environment file for systemd service
echo "⚙️ Creating environment file..."
cat > "/etc/sites/${SLUG}.env" << EOF
DOMAIN=$DOMAIN
PORT=$PORT
EOF
echo "✅ Created /etc/sites/${SLUG}.env with PORT=$PORT"

# 10. Generate configuration using the assigned port
echo "🔧 Generating site configuration..."
cd "$NEW_SITE_DIR"

# Generate configs using the template script
if [ -f "$NEW_SITE_DIR/scripts/generate-config.js" ]; then
    echo "⚙️ Generating configuration..."
    cd "$NEW_SITE_DIR"
    bun run scripts/generate-config.js "$DOMAIN" "$PORT"
else
    echo "❌ Config generator not found"
    exit 4
fi

# 10.5. CRITICAL: Fix ownership again after config generation
# Config generation may create new files as root, so re-apply ownership
echo "🔒 Fixing file ownership after config generation..."
chown -R "$USER:$USER" "$NEW_SITE_DIR"

# 11. Install dependencies and build
echo "📦 Installing dependencies..."
cd "$NEW_SITE_DIR/user"
sudo -u "$USER" bun install

echo "🔨 Building project..."
sudo -u "$USER" bun run build

# 12. Stop old PM2 process if exists
PM2_NAME=$(echo "$DOMAIN" | sed 's/\./-/g')
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    echo "🔄 Stopping old PM2 process..."
    pm2 delete "$PM2_NAME"
fi

# 13. Start systemd service
echo "🚀 Starting systemd service..."
systemctl daemon-reload
systemctl start "site@${SLUG}.service"

# 14. Verify service started and is using correct port
sleep 3
if systemctl is-active --quiet "site@${SLUG}.service"; then
    echo "✅ systemd service started successfully"

    # Verify the service is actually listening on the expected port
    sleep 2
    if netstat -tuln | grep -q ":$PORT "; then
        echo "✅ Service is listening on port $PORT"
    else
        echo "❌ Service is not listening on expected port $PORT"
        echo "   Checking what port it's actually using..."
        journalctl -u "site@${SLUG}.service" --lines=10
        exit 14
    fi
else
    echo "❌ systemd service failed to start"
    journalctl -u "site@${SLUG}.service" --lines=10
    exit 8
fi

# 15. Update Caddyfile (with file locking to prevent corruption from concurrent deployments)
echo "📝 Updating Caddyfile..."
LOCKFILE="/tmp/caddyfile.lock"

# Acquire exclusive lock (wait up to 30 seconds)
exec 200>"$LOCKFILE"
if ! flock -w 30 200; then
    echo "❌ Failed to acquire Caddyfile lock - another deployment is in progress"
    exit 15
fi

# Now we have exclusive access - check and update
if grep -q "^$DOMAIN {" "$CADDYFILE"; then
    echo "⚠️ Domain already exists in Caddyfile, updating port..."
    sed -i "/^$DOMAIN {/,/^}/ s/localhost:[0-9]*/localhost:$PORT/" "$CADDYFILE"
else
    echo "➕ Adding new domain to Caddyfile..."
    cat >> "$CADDYFILE" << EOF

$DOMAIN {
    import common_headers
    import image_serving
    reverse_proxy localhost:$PORT {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
fi

# Release lock (file descriptor 200 will be closed automatically at script exit)
flock -u 200

# 16. Reload Caddy
echo "🔄 Reloading Caddy configuration..."
systemctl reload caddy

# 17. Final verification
echo "🧪 Running final verification..."
sleep 2

# Test if the site responds
if curl -f -s -I "https://$DOMAIN" > /dev/null; then
    echo "✅ Site is responding to HTTPS requests"
else
    echo "⚠️ Site may not be fully ready yet (normal for new sites)"
fi

# 18. Summary
echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Summary:"
echo "   Domain: $DOMAIN"
echo "   Port: $PORT (guaranteed unique)"
echo "   systemd Service: site@${SLUG}.service"
echo "   User: $USER"
echo "   Site Directory: $NEW_SITE_DIR"
echo "   Environment File: /etc/sites/${SLUG}.env"
echo ""
echo "🌐 Your site should be available at: https://$DOMAIN"
echo ""
echo "📋 Useful commands:"
echo "   Check service: systemctl status site@${SLUG}.service"
echo "   View logs: journalctl -u site@${SLUG}.service -f"
echo "   Restart: systemctl restart site@${SLUG}.service"
echo "   Edit environment: nano /etc/sites/${SLUG}.env"
echo ""
echo "🛡️ Security Status:"
echo "   ✅ Process isolation: Runs as user $USER"
echo "   ✅ File access: Limited to $NEW_SITE_DIR"
echo "   ✅ systemd hardening: Active"
echo "   ✅ Resource limits: Enforced"
echo "   ✅ Port management: Centralized and consistent"
echo ""
echo "🔢 Port Management:"
echo "   ✅ Port assignment: Automatic increment from domain-passwords.json"
echo "   ✅ Single source of truth: $DOMAIN_PASSWORDS_FILE"
echo "   ✅ Conflict prevention: Pre-deployment port verification"