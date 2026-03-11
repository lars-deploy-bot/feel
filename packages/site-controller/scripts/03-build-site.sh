#!/bin/bash
set -e

# Source common functions
source "$(dirname "$0")/lib/common.sh"

# Validate required environment variables
require_var SITE_USER SITE_DOMAIN SITE_PORT SITE_SLUG TARGET_DIR ENV_FILE_PATH

log_info "Building site: $SITE_DOMAIN"

# Create environment file for systemd service
log_info "Creating environment file: $ENV_FILE_PATH"
mkdir -p "$(dirname "$ENV_FILE_PATH")"
cat > "$ENV_FILE_PATH" <<EOF
DOMAIN=$SITE_DOMAIN
PORT=$SITE_PORT
EOF

# SECURITY: Restrict env file to root and site user only
# This prevents cross-tenant secret leakage (CVE-like: other sites reading secrets)
chmod 640 "$ENV_FILE_PATH"
chown root:"$SITE_USER" "$ENV_FILE_PATH"

# ── Resolve project root ──────────────────────────────────────────────────
# alive.toml sets PROJECT_ROOT (e.g. "user"), legacy defaults to "user"
PROJECT_ROOT="${PROJECT_ROOT:-user}"

# ── Vite config generation (legacy path) ──────────────────────────────────
# Only runs when there's no alive.toml — alive.toml sites manage their own config.
if [[ "$ALIVE_TOML" != "true" ]]; then
    GENERATE_SCRIPT="${TARGET_DIR}/scripts/generate-config.js"
    if [[ -f "$GENERATE_SCRIPT" ]]; then
        log_info "Generating vite.config.ts for $SITE_DOMAIN:$SITE_PORT..."
        # Fix ownership first so the script runs as the site user (not root)
        chown -R "$SITE_USER:$SITE_USER" "$TARGET_DIR"
        sudo -u "$SITE_USER" bun "$GENERATE_SCRIPT" "$SITE_DOMAIN" "$SITE_PORT" "$TARGET_DIR"
        log_success "vite.config.ts generated"
    else
        # Fallback: patch the existing vite.config.ts copied from the template site.
        log_info "No generate-config.js found, patching existing vite.config.ts..."
        VITE_CONFIG="${TARGET_DIR}/${PROJECT_ROOT}/vite.config.ts"
        if [[ -f "$VITE_CONFIG" ]]; then
            # Patch PORT if not already using process.env.PORT
            if ! grep -q "process.env.PORT" "$VITE_CONFIG"; then
                if grep -q 'export default defineConfig' "$VITE_CONFIG"; then
                    log_info "Patching PORT to $SITE_PORT..."
                    sed -i '/export default defineConfig/i\const PORT = Number(process.env.PORT) || '"$SITE_PORT"';\n' "$VITE_CONFIG"
                    sed -E -i '0,/port:[[:space:]]*[0-9]+/s//port: PORT/' "$VITE_CONFIG"
                    log_success "vite.config.ts PORT patched"
                else
                    log_info "Could not locate defineConfig — skipping PORT patch"
                fi
            fi
            # Patch allowedHosts
            if grep -q 'allowedHosts:' "$VITE_CONFIG"; then
                log_info "Patching allowedHosts to ${SITE_DOMAIN}..."
                sed -E -i 's/allowedHosts:[[:space:]]*\[[^]]*\]/allowedHosts: ["'"$SITE_DOMAIN"'"]/g' "$VITE_CONFIG"
                log_success "vite.config.ts allowedHosts patched"
            fi
        fi
    fi
fi

# Fix ownership before build
log_info "Ensuring correct ownership..."
chown -R "$SITE_USER:$SITE_USER" "$TARGET_DIR"

# ── Build ─────────────────────────────────────────────────────────────────

# Check for pre-built test cache (speeds up E2E tests significantly)
TEST_CACHE_DIR="/tmp/webalive-test-template-cache"
if [[ "$SKIP_BUILD" == "true" ]] && [[ -d "$TEST_CACHE_DIR/node_modules" ]]; then
    log_info "Using pre-built template cache (test mode)..."
    cp -r "$TEST_CACHE_DIR/node_modules" "$TARGET_DIR/" 2>/dev/null || true
    if [[ -d "$TEST_CACHE_DIR/${PROJECT_ROOT}/dist" ]]; then
        mkdir -p "$TARGET_DIR/${PROJECT_ROOT}"
        cp -r "$TEST_CACHE_DIR/${PROJECT_ROOT}/dist" "$TARGET_DIR/${PROJECT_ROOT}/" 2>/dev/null || true
    fi
    chown -R "$SITE_USER:$SITE_USER" "$TARGET_DIR"
    log_success "Skipped build (using cache)"
else
    # Determine where to run setup/build commands
    if [[ "$ALIVE_TOML" == "true" ]]; then
        # alive.toml path: use explicit commands
        # Validate required alive.toml vars before executing
        if [[ -z "$SETUP_COMMAND" ]] || [[ -z "$BUILD_COMMAND" ]]; then
            log_error "alive.toml mode requires SETUP_COMMAND and BUILD_COMMAND"
            exit 13
        fi
        # Setup/build run from TARGET_DIR (workspace root where package.json + bun.lock live),
        # NOT from PROJECT_ROOT (which is the app subdirectory for run commands).
        BUILD_DIR="$TARGET_DIR"
        log_info "Using alive.toml (root=${PROJECT_ROOT})"

        # Setup (install dependencies)
        log_info "Running setup: $SETUP_COMMAND"
        cd "$BUILD_DIR"
        if ! sudo -u "$SITE_USER" bash -c "$SETUP_COMMAND"; then
            log_error "Setup failed: $SETUP_COMMAND"
            exit 13
        fi

        # Build
        log_info "Running build: $BUILD_COMMAND"
        if ! sudo -u "$SITE_USER" bash -c "$BUILD_COMMAND"; then
            log_error "Build failed: $BUILD_COMMAND"
            exit 14
        fi
    else
        # Legacy path: find package.json and run bun install + bun run build
        if [[ -f "${TARGET_DIR}/package.json" ]]; then
            BUILD_DIR="$TARGET_DIR"
            log_info "Found package.json at root (workspace template)"
        elif [[ -f "${TARGET_DIR}/${PROJECT_ROOT}/package.json" ]]; then
            BUILD_DIR="${TARGET_DIR}/${PROJECT_ROOT}"
            log_info "Found package.json in ${PROJECT_ROOT}/ (deployed site template)"
        else
            log_error "No package.json found in $TARGET_DIR or $TARGET_DIR/${PROJECT_ROOT}"
            exit 13
        fi

        # Install dependencies
        log_info "Installing dependencies in $BUILD_DIR..."
        cd "$BUILD_DIR"
        if ! sudo -u "$SITE_USER" bun install; then
            log_error "Failed to install dependencies"
            exit 13
        fi

        # Run build if package.json has build script
        if jq -e '.scripts.build' package.json &>/dev/null; then
            log_info "Running build..."
            if ! sudo -u "$SITE_USER" bun run build; then
                log_error "Build failed"
                exit 14
            fi
        else
            log_info "No build script found, skipping build step"
        fi
    fi

    # Cache the build for future test runs
    if [[ "$SKIP_BUILD" == "true" ]] && [[ ! -d "$TEST_CACHE_DIR" ]]; then
        log_info "Creating test template cache for future runs..."
        mkdir -p "$TEST_CACHE_DIR/${PROJECT_ROOT}"
        cp -r "$TARGET_DIR/node_modules" "$TEST_CACHE_DIR/" 2>/dev/null || true
        [[ -d "$TARGET_DIR/${PROJECT_ROOT}/dist" ]] && cp -r "$TARGET_DIR/${PROJECT_ROOT}/dist" "$TEST_CACHE_DIR/${PROJECT_ROOT}/" 2>/dev/null || true
    fi
fi

# ── Systemd override (alive.toml) ────────────────────────────────────────
# When alive.toml specifies a run command, write a systemd override so
# the service uses that instead of the hardcoded "bun run dev".
if [[ "$ALIVE_TOML" == "true" ]] && [[ -n "$RUN_COMMAND" ]]; then
    OVERRIDE_DIR="/etc/systemd/system/site@${SITE_SLUG}.service.d"
    log_info "Writing systemd override for run command: $RUN_COMMAND"
    mkdir -p "$OVERRIDE_DIR"
    # Write atomically via temp file + mv to avoid partial overrides on interruption
    OVERRIDE_TMP=$(mktemp "$OVERRIDE_DIR/alive-toml.conf.XXXXXX")
    cat > "$OVERRIDE_TMP" <<OVERRIDE_EOF
[Service]
# Generated from alive.toml — do not edit manually
ExecStart=
ExecStart=/bin/sh -c 'exec ${RUN_COMMAND//\'/\'\\\'\'}'
WorkingDirectory=${TARGET_DIR}/${PROJECT_ROOT}
OVERRIDE_EOF
    mv "$OVERRIDE_TMP" "$OVERRIDE_DIR/alive-toml.conf"
    log_success "Systemd override written to $OVERRIDE_DIR/alive-toml.conf"
fi

# Final ownership fix
chown -R "$SITE_USER:$SITE_USER" "$TARGET_DIR"

log_success "Site build complete: $SITE_DOMAIN"
exit 0
