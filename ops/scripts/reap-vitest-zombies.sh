#!/bin/bash
# Kill vitest fork workers running longer than 60 minutes
# These get orphaned when claude sessions disconnect mid-test

pgrep -f 'vitest/dist/workers/forks.js' | while read pid; do
  # Get elapsed time in seconds
  etimes=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
  if [ -n "$etimes" ] && [ "$etimes" -gt 3600 ]; then
    echo "$(date): Killing orphaned vitest worker PID $pid (age: ${etimes}s)"
    kill -9 "$pid"
  fi
done
