#!/bin/bash

# Update CORS domains from /root/webalive/sites/ directory
SITES_DIR="/root/webalive/sites"
OUTPUT_FILE="/root/webalive/claude-bridge/allowed-domains.json"

echo "Scanning for domains in $SITES_DIR..."

# Create array of domains
domains=()

# Add terminal.goalive.nl (always allowed)
domains+=("https://terminal.goalive.nl")

# Scan sites directory for domain folders
if [ -d "$SITES_DIR" ]; then
    for site_dir in "$SITES_DIR"/*; do
        if [ -d "$site_dir" ]; then
            domain=$(basename "$site_dir")

            # Skip non-domain directories
            if [[ "$domain" == "."* ]] || [[ "$domain" == "lost+found" ]]; then
                continue
            fi

            # Add both HTTP and HTTPS variants
            domains+=("https://$domain")
            domains+=("http://$domain")

            echo "Found domain: $domain"
        fi
    done
fi

# Add localhost for development
domains+=("http://localhost:3000")
domains+=("http://localhost:8999")
domains+=("http://127.0.0.1:3000")
domains+=("http://127.0.0.1:8999")

# Convert to JSON array manually
echo "[" > "$OUTPUT_FILE"
for i in "${!domains[@]}"; do
    if [ $i -eq $((${#domains[@]} - 1)) ]; then
        echo "  \"${domains[$i]}\"" >> "$OUTPUT_FILE"
    else
        echo "  \"${domains[$i]}\"," >> "$OUTPUT_FILE"
    fi
done
echo "]" >> "$OUTPUT_FILE"

echo "Updated CORS domains file: $OUTPUT_FILE"
echo "Found ${#domains[@]} domains total"

# Show the domains
echo "Allowed domains:"
for domain in "${domains[@]}"; do
    echo "  $domain"
done