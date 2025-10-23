#!/bin/bash

# Simple deployment script for widget server

echo "Building Claude Widget Server..."

# Build widget
./build.sh

# Build Go binary
echo "Building Go binary..."
go build -o widget-server main.go

# Start with PM2 (production)
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 start widget-server --name claude-widget
    pm2 save
else
    echo "PM2 not found. Starting directly..."
    ./widget-server &
    echo $! > widget-server.pid
    echo "Widget server started with PID $(cat widget-server.pid)"
fi

echo "Widget server deployed on port 3001"
echo ""
echo "Usage in websites:"
echo '<script src="https://yourdomain.com/widget.js" data-workspace="auto"></script>'