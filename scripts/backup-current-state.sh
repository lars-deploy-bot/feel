#!/bin/bash
# Backup current state before migration

set -e

BACKUP_DIR="/var/lib/claude-bridge/backups/$(date +%Y%m%d-%H%M%S)"
DOMAIN_PASSWORDS="/var/lib/claude-bridge/domain-passwords.json"
DATABASE="/var/lib/claude-bridge/database.sqlite"

echo "📦 Creating backup: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup domain-passwords.json
if [ -f "$DOMAIN_PASSWORDS" ]; then
  cp "$DOMAIN_PASSWORDS" "$BACKUP_DIR/domain-passwords.json"
  echo "✓ Backed up: domain-passwords.json"
else
  echo "⚠️  domain-passwords.json not found"
fi

# Backup database if it exists
if [ -f "$DATABASE" ]; then
  cp "$DATABASE" "$BACKUP_DIR/database.sqlite"
  cp "$DATABASE-wal" "$BACKUP_DIR/database.sqlite-wal" 2>/dev/null || true
  cp "$DATABASE-shm" "$BACKUP_DIR/database.sqlite-shm" 2>/dev/null || true
  echo "✓ Backed up: database.sqlite"
fi

# Backup git state
cd /root/webalive/claude-bridge
git rev-parse HEAD > "$BACKUP_DIR/git-commit.txt"
git diff > "$BACKUP_DIR/git-diff.patch" || true
echo "✓ Backed up: git state"

# Create manifest
cat > "$BACKUP_DIR/manifest.txt" <<EOF
Backup created: $(date)
Git commit: $(git rev-parse HEAD)
Git branch: $(git branch --show-current)
Workspaces: $(jq 'keys | length' "$DOMAIN_PASSWORDS" 2>/dev/null || echo "N/A")
EOF

echo "✓ Created: manifest.txt"
echo ""
echo "✅ Backup complete: $BACKUP_DIR"
echo ""
echo "To restore this backup:"
echo "  cp $BACKUP_DIR/domain-passwords.json $DOMAIN_PASSWORDS"
echo "  rm $DATABASE"
echo "  cd /root/webalive/claude-bridge && git checkout \$(cat $BACKUP_DIR/git-commit.txt)"
