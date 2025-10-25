#!/bin/bash

# Create New Site from Template
# Usage: ./create-site.sh domain.com

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 domain.com"
    echo "Example: $0 newwebsite.com"
    exit 1
fi

DOMAIN=$1
SITES_DIR="/root/webalive/sites"
TEMPLATE_DIR="$SITES_DIR/template"
SITE_DIR="$SITES_DIR/$DOMAIN"

echo "🏗️  Creating new site: $DOMAIN"

# 1. Check if template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo "❌ Template directory not found at $TEMPLATE_DIR"
    exit 1
fi

# 2. Check if site already exists
if [ -d "$SITE_DIR" ]; then
    echo "❌ Site directory already exists: $SITE_DIR"
    echo "   Remove it first if you want to recreate:"
    echo "   rm -rf $SITE_DIR"
    exit 1
fi

# 3. Copy template to new site directory
echo "📋 Copying template to $SITE_DIR..."
cp -r "$TEMPLATE_DIR" "$SITE_DIR"

# 4. Update package.json with domain name
echo "📝 Updating package.json..."
PACKAGE_JSON="$SITE_DIR/user/package.json"
if [ -f "$PACKAGE_JSON" ]; then
    # Replace template name with domain-based name
    SAFE_NAME=$(echo "$DOMAIN" | sed 's/\./_/g')
    sed -i "s/\"name\": \".*\"/\"name\": \"$SAFE_NAME\"/" "$PACKAGE_JSON"
fi

# 5. Update vite.config.ts with specific domain
echo "⚙️  Updating vite.config.ts for $DOMAIN..."
VITE_CONFIG="$SITE_DIR/user/vite.config.ts"
if [ -f "$VITE_CONFIG" ]; then
    # Replace wildcard with specific domain
    sed -i "s/allowedHosts: \\[\"\\*\"\\]/allowedHosts: [\"$DOMAIN\"]/" "$VITE_CONFIG"
fi

# 6. Create site-specific deployment guide
echo "📚 Creating site-specific deployment guide..."
cat > "$SITE_DIR/README.md" << EOF
# $DOMAIN

This site was created from the webalive template.

## Quick Deploy

To deploy this site with secure systemd isolation:

\`\`\`bash
/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh $DOMAIN
\`\`\`

This provides:
- ✅ Process isolation (dedicated user, not root)
- ✅ File system restrictions
- ✅ Resource limits and security hardening
- ✅ systemd sandboxing

## Development

\`\`\`bash
cd /root/webalive/sites/$DOMAIN/user
bun install
bun run dev
\`\`\`

## Manual Deployment Steps

See \`/root/webalive/sites/template/DEPLOYMENT.md\` for detailed manual deployment instructions.

## Site Info

- Domain: $DOMAIN
- Created: $(date)
- Template Version: $(date +%Y.%m.%d)
EOF

echo "✅ Site created successfully!"
echo ""
echo "📊 Summary:"
echo "   Domain: $DOMAIN"
echo "   Location: $SITE_DIR"
echo "   Template: $TEMPLATE_DIR"
echo ""
echo "🚀 Next steps:"
echo "   1. Customize your site in: $SITE_DIR/user/src/"
echo "   2. Deploy securely with: /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh $DOMAIN"
echo ""
echo "💡 Quick commands:"
echo "   Navigate to site: cd $SITE_DIR/user"
echo "   Start development: bun run dev"
echo "   Build for production: bun run build"