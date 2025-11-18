#!/bin/bash
# One-time migration: Fix ownership for workspaces with root-owned files
# Run after deploying child process isolation (v5.0)

echo "=== Workspace Ownership Migration ==="
echo "Fixing ownership for systemd workspaces..."
echo

fixed_count=0
skipped_count=0

for site_dir in /srv/webalive/sites/*/user; do
  [ -d "$site_dir" ] || continue

  # Get workspace owner from the user directory itself
  site_user=$(stat -c '%U' "$site_dir")
  site_group=$(stat -c '%G' "$site_dir")

  # Skip if root-owned (not a systemd workspace)
  if [ "$site_user" = "root" ]; then
    echo "⊘ Skipping root-owned workspace: $site_dir"
    ((skipped_count++))
    continue
  fi

  # Check if any files need fixing
  root_files=$(find "$site_dir" -user root 2>/dev/null | wc -l)

  if [ "$root_files" -eq 0 ]; then
    echo "✓ Already correct: $site_dir ($site_user:$site_group)"
    ((skipped_count++))
    continue
  fi

  # Fix ownership
  echo "↻ Fixing: $site_dir → $site_user:$site_group ($root_files root-owned files)"
  chown -R "$site_user:$site_group" "$site_dir"
  ((fixed_count++))
done

echo
echo "=== Migration Complete ==="
echo "Fixed: $fixed_count workspaces"
echo "Skipped: $skipped_count workspaces"
echo

# Final verification (only check non-root workspaces)
echo "Verifying no root-owned files remain in systemd workspaces..."
remaining=0
for site_dir in /srv/webalive/sites/*/user; do
  [ -d "$site_dir" ] || continue
  site_user=$(stat -c '%U' "$site_dir")

  # Only check systemd workspaces (skip root-owned)
  if [ "$site_user" != "root" ]; then
    count=$(find "$site_dir" -user root 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
      echo "⚠ Found $count root-owned files in $site_dir:"
      find "$site_dir" -user root 2>/dev/null | head -5
      remaining=$((remaining + count))
    fi
  fi
done

if [ "$remaining" -eq 0 ]; then
  echo "✓ SUCCESS: All systemd workspace files have correct ownership"
  exit 0
else
  echo "⚠ FAILURE: $remaining root-owned files still found in systemd workspaces"
  exit 1
fi
