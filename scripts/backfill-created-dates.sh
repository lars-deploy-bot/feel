#!/bin/bash

# Backfill createdAt timestamps for existing domains using filesystem dates
# Usage: ./backfill-created-dates.sh

set -e

DOMAIN_PASSWORDS_FILE="/var/lib/claude-bridge/domain-passwords.json"

if [ ! -f "$DOMAIN_PASSWORDS_FILE" ]; then
    echo "❌ Domain passwords file not found: $DOMAIN_PASSWORDS_FILE"
    exit 1
fi

echo "🔍 Backfilling createdAt timestamps for existing domains..."

# Create backup
cp "$DOMAIN_PASSWORDS_FILE" "${DOMAIN_PASSWORDS_FILE}.backup.$(date +%s)"
echo "✅ Created backup"

# Get list of domains
DOMAINS=$(jq -r 'keys[]' "$DOMAIN_PASSWORDS_FILE")

UPDATED_COUNT=0
SKIPPED_COUNT=0

for DOMAIN in $DOMAINS; do
    # Check if domain already has createdAt
    HAS_CREATED_AT=$(jq -r ".[\"$DOMAIN\"].createdAt // \"null\"" "$DOMAIN_PASSWORDS_FILE")

    if [ "$HAS_CREATED_AT" != "null" ]; then
        echo "⏭️  Skipping $DOMAIN (already has createdAt: $HAS_CREATED_AT)"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi

    # Try to find directory in possible locations
    FOUND=false
    for SITE_DIR in "/srv/webalive/sites/$DOMAIN" "/srv/webalive/sites/${DOMAIN//\./-}" "/root/webalive/sites/$DOMAIN"; do
        if [ -d "$SITE_DIR" ]; then
            # Get directory modification time (Unix timestamp)
            TIMESTAMP=$(stat -c %Y "$SITE_DIR" 2>/dev/null || echo "")

            if [ -n "$TIMESTAMP" ]; then
                # Convert to ISO 8601 format
                CREATED_AT=$(date -u -d "@$TIMESTAMP" +"%Y-%m-%dT%H:%M:%S.000Z")

                # Update domain-passwords.json
                jq --arg domain "$DOMAIN" \
                   --arg createdAt "$CREATED_AT" \
                   '.[$domain].createdAt = $createdAt' \
                   "$DOMAIN_PASSWORDS_FILE" > "${DOMAIN_PASSWORDS_FILE}.tmp"
                mv "${DOMAIN_PASSWORDS_FILE}.tmp" "$DOMAIN_PASSWORDS_FILE"

                echo "✅ Updated $DOMAIN with createdAt: $CREATED_AT (from $SITE_DIR)"
                UPDATED_COUNT=$((UPDATED_COUNT + 1))
                FOUND=true
                break
            fi
        fi
    done

    if [ "$FOUND" = false ]; then
        echo "⚠️  Warning: Could not find directory for $DOMAIN, skipping"
    fi
done

echo ""
echo "🎉 Backfill complete!"
echo "   Updated: $UPDATED_COUNT domains"
echo "   Skipped: $SKIPPED_COUNT domains (already had createdAt)"
echo "   Backup: ${DOMAIN_PASSWORDS_FILE}.backup.*"
