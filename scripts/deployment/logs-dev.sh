#!/bin/bash
set -e

# View dev environment logs (systemd)
DEV_SERVICE="claude-bridge-dev"

journalctl -u "$DEV_SERVICE" -n 1000 -f
