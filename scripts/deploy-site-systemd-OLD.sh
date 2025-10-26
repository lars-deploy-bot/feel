#!/bin/bash

# ⚠️ DEPRECATED SCRIPT - DO NOT USE ⚠️
#
# This script has been replaced with an improved version that fixes
# port management issues. The old script had problems with:
# - Port assignment mismatches between systemd and Caddy
# - Auto-assigned ports not matching configuration
# - Inconsistent port registry management
#
# Use the new script instead:
#   /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh
#
# This file is kept for reference only.

echo ""
echo "❌ DEPRECATED SCRIPT"
echo ""
echo "This deployment script has been deprecated due to port management issues."
echo "Please use the improved version:"
echo ""
echo "  /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh $@"
echo ""
echo "The new script provides:"
echo "  ✅ Consistent port assignment"
echo "  ✅ Automatic port increment"
echo "  ✅ Single source of truth for ports"
echo "  ✅ Proper environment file management"
echo ""
exit 1