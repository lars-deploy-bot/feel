#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "This script is meant to be sourced, not executed directly." >&2
  exit 1
fi

parse_url_field() {
  local url="$1"
  local field="$2"

  bun -e '
    const value = process.argv[1]
    const field = process.argv[2]
    const url = new URL(value)
    const resolvedPort = url.port || (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "")
    const fields = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: resolvedPort,
    }
    const result = fields[field]
    if (typeof result !== "string" || result.length === 0) {
      throw new Error(`Unsupported URL field: ${field}`)
    }
    process.stdout.write(result)
  ' "$url" "$field"
}

is_loopback_host() {
  local hostname="$1"
  [[ "$hostname" == "localhost" || "$hostname" == "127.0.0.1" ]]
}

is_private_ipv4() {
  local hostname="$1"
  [[ "$hostname" =~ ^10\. ]] ||
    [[ "$hostname" =~ ^192\.168\. ]] ||
    [[ "$hostname" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]
}

resolve_supabase_source() {
  : "${SUPABASE_URL:?SUPABASE_URL is required for local E2E}"

  export E2E_SUPABASE_SOURCE_PROTOCOL
  E2E_SUPABASE_SOURCE_PROTOCOL="$(parse_url_field "$SUPABASE_URL" protocol)"

  export E2E_SUPABASE_SOURCE_HOST
  E2E_SUPABASE_SOURCE_HOST="$(parse_url_field "$SUPABASE_URL" hostname)"

  export E2E_SUPABASE_SOURCE_PORT
  E2E_SUPABASE_SOURCE_PORT="$(parse_url_field "$SUPABASE_URL" port)"

  if [[ "$E2E_SUPABASE_SOURCE_PROTOCOL" != "https:" && "$E2E_SUPABASE_SOURCE_PROTOCOL" != "http:" ]]; then
    echo "[E2E Supabase] Unsupported SUPABASE_URL protocol: $E2E_SUPABASE_SOURCE_PROTOCOL" >&2
    return 1
  fi

  if [[ "$E2E_SUPABASE_SOURCE_PROTOCOL" == "http:" ]] &&
    ! is_loopback_host "$E2E_SUPABASE_SOURCE_HOST" &&
    ! is_private_ipv4 "$E2E_SUPABASE_SOURCE_HOST"; then
    echo "[E2E Supabase] Refusing public HTTP Supabase target: $SUPABASE_URL" >&2
    return 1
  fi
}

is_remote_http_supabase() {
  [[ "${E2E_SUPABASE_SOURCE_PROTOCOL:-}" == "http:" ]] && ! is_loopback_host "${E2E_SUPABASE_SOURCE_HOST:-}"
}

REMOTE_SUPABASE_ENV_PATH="/opt/services/supabase/.env"

fetch_remote_supabase_env_value() {
  local ssh_target="$1"
  local key="$2"

  ssh -o BatchMode=yes "$ssh_target" \
    "grep -E '^${key}=' '$REMOTE_SUPABASE_ENV_PATH' | tail -n 1 | cut -d= -f2-"
}

sync_remote_supabase_credentials() {
  if ! is_remote_http_supabase; then
    return 0
  fi

  local ssh_target="root@${E2E_SUPABASE_SOURCE_HOST}"

  echo "[E2E Supabase] Syncing anon/service keys from $ssh_target:$REMOTE_SUPABASE_ENV_PATH"

  export SUPABASE_ANON_KEY
  SUPABASE_ANON_KEY="$(fetch_remote_supabase_env_value "$ssh_target" "ANON_KEY")"
  if [[ -z "$SUPABASE_ANON_KEY" ]]; then
    echo "[E2E Supabase] Remote ANON_KEY is empty at $ssh_target:$REMOTE_SUPABASE_ENV_PATH" >&2
    return 1
  fi

  export NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

  export SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_SERVICE_ROLE_KEY="$(fetch_remote_supabase_env_value "$ssh_target" "SERVICE_ROLE_KEY")"
  if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo "[E2E Supabase] Remote SERVICE_ROLE_KEY is empty at $ssh_target:$REMOTE_SUPABASE_ENV_PATH" >&2
    return 1
  fi

  export JWT_SECRET
  JWT_SECRET="$(fetch_remote_supabase_env_value "$ssh_target" "JWT_SECRET")"
  if [[ -z "$JWT_SECRET" ]]; then
    echo "[E2E Supabase] Remote JWT_SECRET is empty at $ssh_target:$REMOTE_SUPABASE_ENV_PATH" >&2
    return 1
  fi
}
