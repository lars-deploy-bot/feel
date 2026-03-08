#!/bin/bash
# Reap orphaned processes that accumulate and cause server overload.
# Runs every 15 minutes via cron.
#
# History of outages this prevents:
# - 2026-03-06: 35 zombie Puppeteer Chrome from stealth-scraper → load 18+
# - 2026-03-08: 9 orphaned Playwright Chrome (2 days old) + stale Claude instances
#
# Does NOT touch:
# - stealth-scraper Chrome (containerized, has pids:200 limit)
# - systemd-managed bun/node processes (site@*.service, template@*.service)

LOG_PREFIX="[reap]"
KILLED=0

reap_by_pattern() {
  local pattern="$1"
  local max_age="$2"
  local label="$3"
  local signal="${4:--9}"

  pgrep -f "$pattern" 2>/dev/null | while read pid; do
    etimes=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ -n "$etimes" ] && [ "$etimes" -gt "$max_age" ]; then
      cmd=$(ps -o args= -p "$pid" 2>/dev/null | head -c 120)
      echo "$(date) $LOG_PREFIX Killing $label PID $pid (age: ${etimes}s) — $cmd"
      kill $signal "$pid" 2>/dev/null
      KILLED=$((KILLED + 1))
    fi
  done
}

# --- Browsers (2 hour max) ---

# Playwright Chrome (E2E tests)
reap_by_pattern 'playwright_chromiumdev_profile' 7200 "playwright-chrome"

# Playwright headless shell
reap_by_pattern 'chrome-headless-shell' 7200 "chrome-headless-shell"

# --- Dev/test servers (4 hour max) ---

# Orphaned next dev in the alive repo (from test runs or manual dev)
# Only matches /root/webalive paths — does NOT touch site-managed next processes
reap_by_pattern '/root/webalive.*next dev' 14400 "orphaned-next-dev"

# Orphaned E2E test servers (start-server.js spawned by Playwright)
reap_by_pattern 'start-server\.js' 14400 "orphaned-test-server"

# --- Claude instances (6 hour max) ---

# Interactive Claude sessions that outlived their terminal
reap_by_pattern '^claude$' 21600 "stale-claude" "-TERM"

# Claude Agent SDK CLI workers that outlived their parent
reap_by_pattern 'claude-agent-sdk/cli\.js' 21600 "stale-claude-sdk" "-TERM"

# --- Vitest workers (1 hour max — covered by separate reaper but belt-and-suspenders) ---

reap_by_pattern 'vitest/dist/workers' 3600 "vitest-worker"

# --- /tmp cleanup (dirs older than 1 day) ---

clean_tmp() {
  local pattern="$1"
  local label="$2"
  local count=0

  for dir in /tmp/${pattern}; do
    [ -e "$dir" ] || continue
    # Check if dir is older than 24h (find -mmin +1440)
    if find "$dir" -maxdepth 0 -mmin +1440 -print -quit 2>/dev/null | grep -q .; then
      rm -rf "$dir" 2>/dev/null && count=$((count + 1))
    fi
  done

  if [ "$count" -gt 0 ]; then
    echo "$(date) $LOG_PREFIX Cleaned $count stale $label dirs from /tmp"
  fi
}

clean_tmp "playwright_chromiumdev_profile-*" "playwright-profile"
clean_tmp "puppeteer_dev_profile-*" "puppeteer-profile"
clean_tmp "alive-deploy-*" "deploy-staging"
clean_tmp "claude-home-*" "claude-home"
clean_tmp "bunx-*" "bunx-cache"

if [ "$KILLED" -gt 0 ]; then
  echo "$(date) $LOG_PREFIX Total killed: $KILLED processes"
fi
