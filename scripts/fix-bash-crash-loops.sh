#!/bin/bash

# Emergency fix for PM2 bash crash loops
# This script detects and fixes PM2 processes using bash instead of bun

echo "🚨 Emergency PM2 Bash Crash Loop Fixer"
echo "Scanning for problematic processes..."

# Get list of all PM2 processes with bash in script path
BASH_PROCESSES=$(pm2 jlist 2>/dev/null | grep -o '"name":"[^"]*".*"pm_exec_path":"[^"]*bash[^"]*"' | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BASH_PROCESSES" ]; then
    echo "✅ No bash crash loops detected"
    exit 0
fi

echo "⚠️  Found processes using bash instead of bun:"
echo "$BASH_PROCESSES"
echo ""

for PROCESS_NAME in $BASH_PROCESSES; do
    echo "🔧 Fixing $PROCESS_NAME..."

    # Extract domain from process name
    DOMAIN=$(echo "$PROCESS_NAME" | sed 's/-/./g')
    SITE_DIR="/root/webalive/sites/$DOMAIN"

    if [ ! -d "$SITE_DIR" ]; then
        echo "❌ Site directory not found: $SITE_DIR"
        continue
    fi

    # Delete the broken process
    echo "🗑️  Deleting broken PM2 process..."
    pm2 delete "$PROCESS_NAME" || true

    # Regenerate config if config generator exists
    if [ -f "$SITE_DIR/scripts/generate-config.js" ]; then
        echo "⚙️  Regenerating configuration..."
        cd "$SITE_DIR"

        # Extract port from Caddyfile
        PORT=$(grep -A 2 "^$DOMAIN {" /root/webalive/claude-bridge/Caddyfile | grep "localhost:" | cut -d: -f2 | tr -d ' ')

        if [ -z "$PORT" ]; then
            echo "❌ Could not determine port for $DOMAIN"
            continue
        fi

        bun run scripts/generate-config.js "$DOMAIN" "$PORT"

        # Start with new config
        echo "🚀 Starting with new configuration..."
        pm2 start ecosystem.config.js

        echo "✅ Fixed $PROCESS_NAME"
    else
        echo "❌ No config generator found for $DOMAIN"
    fi

    echo ""
done

echo "🏁 Emergency fix complete"
echo "📋 Current PM2 status:"
pm2 list