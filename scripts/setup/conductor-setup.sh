#!/usr/bin/env bash
set -euo pipefail

command -v bun >/dev/null 2>&1 || {
    echo "Error: bun is not installed"
    echo "Install from: https://bun.sh"
    exit 1
}

# Resolve project root from this script location so setup works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    echo "Error: package.json not found at $PROJECT_ROOT"
    exit 1
fi

echo "Setting up workspace..."

(
    cd "$PROJECT_ROOT"
    bun install
) || {
    echo "Error: Failed to install dependencies"
    exit 1
}

# Creates .alive/template directory
(
    cd "$PROJECT_ROOT"
    bun run setup
) || {
    echo "Error: Project setup failed"
    exit 1
}

# Generate .env.local for local dev
ENV_DEST="$PROJECT_ROOT/apps/web/.env.local"
TEMPLATE_PATH="$PROJECT_ROOT/.alive/template"

mkdir -p "$(dirname "$ENV_DEST")"
touch "$ENV_DEST"

upsert_env_var() {
    local key="$1"
    local value="$2"

    if grep -q "^${key}=" "$ENV_DEST"; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_DEST"
        rm -f "$ENV_DEST.bak"
    else
        printf "%s=%s\n" "$key" "$value" >> "$ENV_DEST"
    fi
}

ensure_env_var() {
    local key="$1"
    local value="$2"

    if ! grep -q "^${key}=" "$ENV_DEST"; then
        printf "%s=%s\n" "$key" "$value" >> "$ENV_DEST"
    fi
}

upsert_env_var "STREAM_ENV" "local"
upsert_env_var "LOCAL_TEMPLATE_PATH" "$TEMPLATE_PATH"
ensure_env_var "NEXT_PUBLIC_PREVIEW_BASE" "localhost"

# Minimal placeholders for local env validation. Real Supabase values can still
# be provided in apps/web/.env.local and will be preserved.
ensure_env_var "SUPABASE_URL" "https://placeholder.supabase.co"
ensure_env_var "SUPABASE_ANON_KEY" "eyJ.placeholder"
ensure_env_var "SUPABASE_SERVICE_ROLE_KEY" "eyJ.placeholder"
ensure_env_var "NEXT_PUBLIC_SUPABASE_URL" "https://placeholder.supabase.co"
ensure_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "eyJ.placeholder"
ensure_env_var "JWT_SECRET" "local-dev-jwt-secret-change-me"
ensure_env_var "LOCKBOX_MASTER_KEY" "0000000000000000000000000000000000000000000000000000000000000000"

cat <<EOF

✓ Workspace ready

  bun run dev  # Start dev server at http://localhost:8997

  Login:
    Email:    test@stream.local
    Password: test

  Note:
    If you connect to a real Supabase project, set JWT_SECRET to that project's JWT secret.
EOF
