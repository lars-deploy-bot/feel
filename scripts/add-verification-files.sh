#!/bin/bash
# Add verification files to all existing sites

# Don't exit on error, continue processing all sites
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_IP="138.201.56.93"
SITES_DIR="/srv/webalive/sites"
LEGACY_SITES_DIR="/root/webalive/sites"

echo "🔍 Adding verification files to all sites..."
echo "Server IP: $SERVER_IP"
echo ""

sites_updated=0
sites_failed=0

# Function to add verification file to a site
add_verification_file() {
    local site_path="$1"
    local domain=$(basename "$site_path")

    # Skip if not a directory
    if [ ! -d "$site_path" ]; then
        return
    fi

    echo "📝 Processing: $domain"

    # Check for user directory
    if [ ! -d "$site_path/user" ]; then
        echo "   ⚠️  No user directory found, skipping"
        return
    fi

    # Create public/.well-known directory
    local public_dir="$site_path/user/public"
    local wellknown_dir="$public_dir/.well-known"
    local verify_file="$wellknown_dir/bridge-verify.txt"

    # Create directories
    mkdir -p "$wellknown_dir"

    # Write verification file
    echo "$SERVER_IP" > "$verify_file"

    # Get the site user (format: site-domain-com)
    local site_slug=$(echo "$domain" | sed 's/[^a-zA-Z0-9]/-/g')
    local site_user="site-$site_slug"

    # Check if user exists
    if id "$site_user" &>/dev/null; then
        # Fix ownership
        chown -R "$site_user:$site_user" "$public_dir"
        echo "   ✅ Added and set ownership to $site_user"
        ((sites_updated++))
    else
        echo "   ⚠️  User $site_user not found, file added but ownership not set"
        ((sites_updated++))
    fi
}

# Process systemd sites
if [ -d "$SITES_DIR" ]; then
    echo "🔍 Checking systemd sites in $SITES_DIR..."
    for site_dir in "$SITES_DIR"/*; do
        add_verification_file "$site_dir"
    done
    echo ""
fi

# Process legacy PM2 sites
if [ -d "$LEGACY_SITES_DIR" ]; then
    echo "🔍 Checking legacy sites in $LEGACY_SITES_DIR..."
    for site_dir in "$LEGACY_SITES_DIR"/*; do
        # Skip template directory
        if [ "$(basename "$site_dir")" == "template" ]; then
            continue
        fi
        add_verification_file "$site_dir"
    done
    echo ""
fi

echo "════════════════════════════════════════════"
echo "✅ Complete!"
echo "   Updated: $sites_updated sites"
if [ $sites_failed -gt 0 ]; then
    echo "   Failed:  $sites_failed sites"
fi
echo "════════════════════════════════════════════"
