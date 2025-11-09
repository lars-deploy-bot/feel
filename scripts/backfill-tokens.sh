#!/bin/bash

# Backfill tokens field for all domains in domain-passwords.json
# Sets all domains to 200 tokens (starting balance per workspace)

set -e

DOMAIN_PASSWORDS_FILE="/var/lib/claude-bridge/domain-passwords.json"
BACKUP_FILE="${DOMAIN_PASSWORDS_FILE}.backup-$(date +%Y%m%d-%H%M%S)"

echo "Backing up to: $BACKUP_FILE"
cp "$DOMAIN_PASSWORDS_FILE" "$BACKUP_FILE"

echo "Updating all domains to 200 tokens..."

# Update all domains to have tokens: 200
jq 'to_entries | map(.value.tokens = 200) | from_entries' "$DOMAIN_PASSWORDS_FILE" > "${DOMAIN_PASSWORDS_FILE}.tmp"
mv "${DOMAIN_PASSWORDS_FILE}.tmp" "$DOMAIN_PASSWORDS_FILE"

echo "✅ All domains updated to 200 tokens"
echo "Domains updated: $(jq 'length' "$DOMAIN_PASSWORDS_FILE")"
