#!/bin/bash
# Automation Scheduler - Shell wrapper
#
# This wrapper ensures proper environment loading and runs the TypeScript scheduler.
# Runs on the production server via cron every 5 minutes.
#
# Cron entry: */5 * * * * /root/webalive/claude-bridge/scripts/automation/run-due-jobs.sh >> /var/log/automation-scheduler.log 2>&1

set -e

# Change to project directory
cd /root/webalive/claude-bridge

# Source production environment variables
if [ -f /root/webalive/claude-bridge/apps/web/.env.production ]; then
  export $(grep -v '^#' /root/webalive/claude-bridge/apps/web/.env.production | xargs 2>/dev/null || true)
fi

# Run the scheduler
exec bun run scripts/automation/run-due-jobs.ts
