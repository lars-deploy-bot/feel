#!/bin/bash

# Ultra-minimal widget build script
echo "Building minimal Claude widget..."

# Minify JavaScript (basic minification)
cat widget.js | \
    # Remove comments
    sed '/^[[:space:]]*\/\*/,/\*\//d' | \
    sed 's|//.*$||g' | \
    # Remove empty lines
    sed '/^[[:space:]]*$/d' | \
    # Basic compression
    tr -d '\n' | \
    sed 's/[[:space:]]\+/ /g' | \
    sed 's/; /;/g' | \
    sed 's/{ /{/g' | \
    sed 's/ }/}/g' \
    > widget.min.js

# Create gzipped version
gzip -c widget.min.js > widget.min.js.gz

# Show stats
ORIGINAL_SIZE=$(wc -c < widget.js)
MINIFIED_SIZE=$(wc -c < widget.min.js)
GZIPPED_SIZE=$(wc -c < widget.min.js.gz)

echo "Original: ${ORIGINAL_SIZE} bytes"
echo "Minified: ${MINIFIED_SIZE} bytes ($(( (ORIGINAL_SIZE - MINIFIED_SIZE) * 100 / ORIGINAL_SIZE ))% reduction)"
echo "Gzipped:  ${GZIPPED_SIZE} bytes ($(( (ORIGINAL_SIZE - GZIPPED_SIZE) * 100 / ORIGINAL_SIZE ))% reduction from original)"

if [ $GZIPPED_SIZE -lt 3072 ]; then
    echo "✅ Widget is under 3KB gzipped!"
else
    echo "⚠️  Widget is ${GZIPPED_SIZE} bytes gzipped (target: <3KB)"
fi