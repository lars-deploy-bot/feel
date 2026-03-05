#!/usr/bin/env bash
set -euo pipefail

ALIVE_ROOT=""
ENABLE_REQUIRED_TIMERS=0
VERIFY_REQUIRED_TIMERS=0
VALIDATE_ONLY=0

usage() {
  cat <<USAGE
Usage: $0 --alive-root <path> [--enable-required-timers] [--verify-required-timers] [--validate-only]

Options:
  --alive-root <path>         Absolute repo path (contains ops/systemd/*)
  --enable-required-timers    Enable and start timers listed in ops/systemd/required-timers.list
  --verify-required-timers    Hard-fail unless required timers are enabled and active
  --validate-only             Validate list files and templates only; do not modify systemd
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --alive-root)
      if [ "$#" -lt 2 ]; then
        echo "ERROR: --alive-root requires a value" >&2
        usage >&2
        exit 1
      fi
      ALIVE_ROOT="$2"
      shift 2
      ;;
    --enable-required-timers)
      ENABLE_REQUIRED_TIMERS=1
      shift
      ;;
    --verify-required-timers)
      VERIFY_REQUIRED_TIMERS=1
      shift
      ;;
    --validate-only)
      VALIDATE_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$ALIVE_ROOT" ]; then
  echo "ERROR: --alive-root is required" >&2
  usage >&2
  exit 1
fi

if [ ! -d "$ALIVE_ROOT" ]; then
  echo "ERROR: ALIVE_ROOT does not exist: $ALIVE_ROOT" >&2
  exit 1
fi

SYSTEMD_DIR="$ALIVE_ROOT/ops/systemd"
MANAGED_UNITS_FILE="$SYSTEMD_DIR/managed-units.list"
REQUIRED_TIMERS_FILE="$SYSTEMD_DIR/required-timers.list"

read_unit_list() {
  local list_file="$1"

  if [ ! -f "$list_file" ]; then
    echo "ERROR: Missing unit list file: $list_file" >&2
    return 1
  fi

  awk '
    {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
      if ($0 == "" || $0 ~ /^#/) {
        next
      }
      print $0
    }
  ' "$list_file"
}

mapfile -t managed_units < <(read_unit_list "$MANAGED_UNITS_FILE")
mapfile -t required_timers < <(read_unit_list "$REQUIRED_TIMERS_FILE")

if [ "${#managed_units[@]}" -eq 0 ]; then
  echo "ERROR: No units found in $MANAGED_UNITS_FILE" >&2
  exit 1
fi

if [ "${#required_timers[@]}" -eq 0 ]; then
  echo "ERROR: No timers found in $REQUIRED_TIMERS_FILE" >&2
  exit 1
fi

for unit in "${managed_units[@]}"; do
  template_path="$SYSTEMD_DIR/$unit"

  if [ ! -f "$template_path" ]; then
    echo "ERROR: Missing systemd template: $template_path" >&2
    exit 1
  fi
done

if [ "$VALIDATE_ONLY" -eq 1 ]; then
  echo "Validated ${#managed_units[@]} ops units from $SYSTEMD_DIR"
  exit 0
fi

for unit in "${managed_units[@]}"; do
  template_path="$SYSTEMD_DIR/$unit"
  destination_path="/etc/systemd/system/$unit"

  sed "s#__ALIVE_ROOT__#$ALIVE_ROOT#g" "$template_path" > "$destination_path"
done

systemctl daemon-reload

if [ "$ENABLE_REQUIRED_TIMERS" -eq 1 ]; then
  systemctl enable --now "${required_timers[@]}"
fi

if [ "$VERIFY_REQUIRED_TIMERS" -eq 1 ]; then
  for timer in "${required_timers[@]}"; do
    if ! systemctl is-enabled --quiet "$timer"; then
      echo "ERROR: $timer is not enabled" >&2
      exit 1
    fi

    if ! systemctl is-active --quiet "$timer"; then
      echo "ERROR: $timer is not active" >&2
      exit 1
    fi
  done
fi

echo "Synced ${#managed_units[@]} ops units from $SYSTEMD_DIR"
