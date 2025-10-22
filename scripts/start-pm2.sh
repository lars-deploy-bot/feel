#!/bin/bash
# Stop and delete all existing claude-bridge processes
pm2 delete claude-bridge 2>/dev/null || true
# Kill any existing Next.js processes
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
# Remove Next.js lock file
rm -f apps/web/.next/dev/lock 2>/dev/null || true
bun i
pm2 start "bun run web" --name claude-bridge