#!/bin/bash
# Test script to prove file locking prevents Caddyfile corruption

set -e

TEST_DIR="/tmp/caddyfile-lock-test-$$"
CADDYFILE="$TEST_DIR/Caddyfile"
LOCKFILE="$TEST_DIR/caddyfile.lock"
RESULTS_FILE="$TEST_DIR/results.txt"

# Setup
mkdir -p "$TEST_DIR"
echo "# Test Caddyfile" > "$CADDYFILE"

# Function to append with locking (safe)
append_with_lock() {
    local domain=$1
    local port=$2

    # Acquire lock
    exec 200>"$LOCKFILE"
    if ! flock -w 30 200; then
        echo "FAILED: Could not acquire lock for $domain" >> "$RESULTS_FILE"
        return 1
    fi

    # Check if domain exists
    if grep -q "^$domain {" "$CADDYFILE"; then
        echo "SKIPPED: $domain already exists" >> "$RESULTS_FILE"
    else
        # Append entry
        cat >> "$CADDYFILE" << EOF

$domain {
    import common_headers
    import image_serving
    reverse_proxy localhost:$port {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
        echo "SUCCESS: Added $domain" >> "$RESULTS_FILE"
    fi

    # Release lock
    flock -u 200
}

# Function to append WITHOUT locking (unsafe)
append_without_lock() {
    local domain=$1
    local port=$2

    # No lock - just check and append
    if grep -q "^$domain {" "$CADDYFILE"; then
        echo "SKIPPED: $domain already exists" >> "$RESULTS_FILE"
    else
        cat >> "$CADDYFILE" << EOF

$domain {
    import common_headers
    import image_serving
    reverse_proxy localhost:$port {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
        echo "SUCCESS: Added $domain" >> "$RESULTS_FILE"
    fi
}

# Validation function
validate_caddyfile() {
    local expected_domains=$1
    local file=$2

    # Count domain entries
    local actual_domains=$(grep -c "^[a-z0-9.-]* {" "$file" || true)

    # Check for malformed entries (missing closing braces)
    local open_braces=$(grep -c "{" "$file")
    local close_braces=$(grep -c "}" "$file")

    if [ "$actual_domains" -ne "$expected_domains" ]; then
        echo "❌ VALIDATION FAILED: Expected $expected_domains domains, found $actual_domains"
        return 1
    fi

    if [ "$open_braces" -ne "$close_braces" ]; then
        echo "❌ VALIDATION FAILED: Mismatched braces (open: $open_braces, close: $close_braces)"
        return 1
    fi

    # Check for incomplete entries (domain without closing brace before next domain)
    if grep -Pzo '(?s)\w+\.\w+ \{[^}]*\n\w+\.\w+ \{' "$file" > /dev/null 2>&1; then
        echo "❌ VALIDATION FAILED: Found incomplete entry (missing closing brace)"
        return 1
    fi

    echo "✅ VALIDATION PASSED: $actual_domains domains, braces balanced"
    return 0
}

echo "=========================================="
echo "Test 1: WITHOUT locking (should corrupt)"
echo "=========================================="

# Reset
echo "# Test Caddyfile" > "$CADDYFILE"
> "$RESULTS_FILE"

# Launch 10 concurrent appends WITHOUT locking
for i in {1..10}; do
    (append_without_lock "test$i.example.com" "$((3000 + i))" &)
done

# Wait for all to complete
wait

echo ""
echo "Results without locking:"
cat "$RESULTS_FILE"
echo ""
echo "Caddyfile validation:"
validate_caddyfile 10 "$CADDYFILE" || echo "(Corruption expected)"

echo ""
echo "=========================================="
echo "Test 2: WITH locking (should be safe)"
echo "=========================================="

# Reset
echo "# Test Caddyfile" > "$CADDYFILE"
> "$RESULTS_FILE"
rm -f "$LOCKFILE"

# Launch 10 concurrent appends WITH locking
for i in {1..10}; do
    (append_with_lock "test$i.example.com" "$((3000 + i))" &)
done

# Wait for all to complete
wait

echo ""
echo "Results with locking:"
cat "$RESULTS_FILE"
echo ""
echo "Caddyfile validation:"
if validate_caddyfile 10 "$CADDYFILE"; then
    echo ""
    echo "🎉 SUCCESS: File locking prevented corruption!"
    exit 0
else
    echo ""
    echo "❌ FAILURE: File locking did not prevent corruption"
    exit 1
fi
