#!/bin/bash
# Cleanup old .builds artifacts, keeping the 2 most recent per environment.
# Runs daily at 3am UTC via cron. Logs: /tmp/builds-cleanup.log

set -euo pipefail

BUILDS_DIR="/root/webalive/alive/.builds"

for env_dir in "$BUILDS_DIR"/*/; do
    [ ! -d "$env_dir" ] && continue

    # Get the active build (symlink target)
    CURRENT=""
    [ -L "${env_dir}current" ] && CURRENT=$(basename "$(readlink "${env_dir}current")")

    # List builds sorted newest first, skip the active one, keep 1 extra (rollback)
    KEEP=1
    SKIPPED=0
    for build in $(ls -dt "${env_dir}"dist.* 2>/dev/null); do
        name=$(basename "$build")

        # Never delete the active build
        [ "$name" = "$CURRENT" ] && continue

        if [ $SKIPPED -lt $KEEP ]; then
            SKIPPED=$((SKIPPED + 1))
            continue
        fi

        echo "[cleanup] Removing $build"
        rm -rf "$build"
    done
done
