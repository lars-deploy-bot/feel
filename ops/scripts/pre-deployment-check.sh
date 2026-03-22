#!/bin/bash
# =============================================================================
# Pre-deployment safety checks
# =============================================================================
# Run this BEFORE attempting any deployment to catch issues early.
# Exit 0 = all clear, exit 1 = blocking issue found.
#
# Philosophy: every past outage gets a check here so it never happens again.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$PROJECT_ROOT/scripts/deployment/lib/deploy-contract.sh"

ENVIRONMENT="${1:-staging}"
VERBOSE="${2:-0}"

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "Usage: $0 [staging|production] [verbose]"
  exit 1
fi

case "$ENVIRONMENT" in
  "$DEPLOY_ENV_STAGING")
    SERVICE="alive-staging"
    PORT=$DEPLOY_PORT_STAGING
    ENV_FILE="$PROJECT_ROOT/apps/web/.env.staging"
    ;;
  "$DEPLOY_ENV_PRODUCTION")
    SERVICE="alive-production"
    PORT=$DEPLOY_PORT_PRODUCTION
    ENV_FILE="$PROJECT_ROOT/apps/web/.env.production"
    ;;
esac

REDIS_ENV_FILE="$ENV_FILE"
if [ ! -f "$REDIS_ENV_FILE" ]; then
  REDIS_ENV_FILE="$PROJECT_ROOT/apps/web/.env.production"
fi

REDIS_PASSWORD=""
if [ -f "$REDIS_ENV_FILE" ]; then
  REDIS_URL=$(grep '^REDIS_URL=' "$REDIS_ENV_FILE" | cut -d= -f2- || true)
  REDIS_PASSWORD=$(printf '%s' "$REDIS_URL" | sed -n 's#redis://:\([^@]*\)@.*#\1#p')
fi

redis_persistence_ok() {
  REDIS_PING=$(REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h 127.0.0.1 -p 6379 PING 2>/dev/null || true)
  if [ "$REDIS_PING" != "PONG" ]; then
    echo "Redis not reachable on 127.0.0.1:6379"
    return 1
  fi

  REDIS_INFO=$(REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h 127.0.0.1 -p 6379 INFO persistence 2>/dev/null || true)
  if [ -z "$REDIS_INFO" ]; then
    echo "redis-cli INFO persistence returned no data"
    return 1
  fi

  AOF_STATUS=$(printf '%s\n' "$REDIS_INFO" | awk -F: '/^aof_last_write_status:/ {print $2}' | tr -d '\r')
  RDB_STATUS=$(printf '%s\n' "$REDIS_INFO" | awk -F: '/^rdb_last_bgsave_status:/ {print $2}' | tr -d '\r')

  if [ "$AOF_STATUS" != "ok" ]; then
    echo "Redis AOF writes failing (aof_last_write_status=$AOF_STATUS)"
    return 1
  fi

  if [ "$RDB_STATUS" != "ok" ]; then
    echo "Redis RDB background save failing (rdb_last_bgsave_status=$RDB_STATUS)"
    return 1
  fi

  echo "Redis persistence OK (AOF=$AOF_STATUS, RDB=$RDB_STATUS)"
  return 0
}

TOTAL_CHECKS=16
echo "========================================="
echo "PRE-DEPLOYMENT CHECKS: $ENVIRONMENT"
echo "========================================="
echo ""

ISSUES=0
CHECK=0

fail_check() {
  echo "  FAIL: $1"
  ISSUES=$((ISSUES + 1))
}

warn_check() {
  echo "  WARN: $1"
}

pass_check() {
  echo "  OK: $1"
}

# ============================================================================
# CHECK 1: Runtime target exists
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Runtime target..."
if systemctl list-unit-files | grep -q "^${SERVICE}.service"; then
  STATUS=$(systemctl is-active "$SERVICE" 2>/dev/null || echo "unknown")
  pass_check "$SERVICE ($STATUS)"
  if [ "$STATUS" = "failed" ]; then
    fail_check "Service is in failed state — run: systemctl reset-failed $SERVICE"
  fi
else
  fail_check "No systemd unit found: $SERVICE"
  STATUS="missing"
fi

# ============================================================================
# CHECK 2: Redis health and persistence
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Redis health..."
if REDIS_RESULT=$(redis_persistence_ok); then
  pass_check "$REDIS_RESULT"
else
  fail_check "$REDIS_RESULT"
fi

# ============================================================================
# CHECK 3: Port availability
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Port $PORT..."
if ss -ltn "( sport = :$PORT )" | grep -q LISTEN; then
  pass_check "Port $PORT is in use ($SERVICE responding)"
else
  if [ "$STATUS" = "active" ]; then
    fail_check "Service is 'active' but port $PORT is not listening"
  else
    pass_check "Port $PORT available (service not yet running)"
  fi
fi

# ============================================================================
# CHECK 4: Disk space (15 GB minimum for builds)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Disk space..."
BUILD_DIR="$PROJECT_ROOT/.builds/$ENVIRONMENT"
MIN_FREE_GB=15

DISK_CHECK_PATH="$BUILD_DIR"
[[ ! -d "$DISK_CHECK_PATH" ]] && DISK_CHECK_PATH="$PROJECT_ROOT"
DISK_FREE_KB=$(df -k "$DISK_CHECK_PATH" | awk 'NR==2 {print $4}')
DISK_FREE_GB=$(awk "BEGIN {printf \"%.1f\", $DISK_FREE_KB / 1024 / 1024}")

if awk "BEGIN {exit !($DISK_FREE_GB >= $MIN_FREE_GB)}"; then
  pass_check "${DISK_FREE_GB} GiB free"
else
  fail_check "Only ${DISK_FREE_GB} GiB free (need ${MIN_FREE_GB} GiB for builds)"
fi

# ============================================================================
# CHECK 5: Memory (500 MB minimum, Next.js builds need ~1.5 GB)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Available memory..."
MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')

if [ "$MEM_AVAILABLE" -lt 500 ]; then
  fail_check "Available memory ${MEM_AVAILABLE} MB (< 500 MB) — builds will OOM"
elif [ "$MEM_AVAILABLE" -lt 1000 ]; then
  warn_check "Available memory ${MEM_AVAILABLE} MB (< 1 GB) — builds may be slow"
else
  pass_check "${MEM_AVAILABLE} MB available"
fi

# ============================================================================
# CHECK 6: Health endpoint of current deployment
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Health endpoint..."
HEALTH_ENDPOINT="http://localhost:$PORT/api/health"

if curl -sf "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
  pass_check "Health endpoint responding"
else
  if [ "$STATUS" = "active" ] || [ "$STATUS" = "running" ]; then
    warn_check "Health endpoint not responding (service may be starting)"
  else
    pass_check "Service not running (health check skipped)"
  fi
fi

# ============================================================================
# CHECK 7: Build directory writable
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Build directory..."
if [ -d "$BUILD_DIR" ]; then
  if [ -w "$BUILD_DIR" ]; then
    pass_check "$BUILD_DIR exists and is writable"
  else
    fail_check "$BUILD_DIR is not writable"
  fi
else
  # Parent must be writable so the deployer can create it
  PARENT="$PROJECT_ROOT/.builds"
  if [ -d "$PARENT" ] && [ -w "$PARENT" ]; then
    pass_check "$BUILD_DIR will be created (parent writable)"
  else
    fail_check "Build parent directory $PARENT missing or not writable"
  fi
fi

# ============================================================================
# CHECK 8: Environment file exists and has required vars
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Environment file..."
if [ ! -f "$ENV_FILE" ]; then
  fail_check "Environment file missing: $ENV_FILE"
else
  MISSING_VARS=""
  # Core vars that every environment MUST have
  for var in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY ANTH_API_SECRET \
             REDIS_URL JWT_SECRET DATABASE_URL DATABASE_PASSWORD \
             ALIVE_PASSCODE IMAGES_SIGNATURE_SECRET LOCKBOX_MASTER_KEY; do
    if ! grep -q "^${var}=" "$ENV_FILE"; then
      MISSING_VARS="$MISSING_VARS $var"
    fi
  done
  if [ -n "$MISSING_VARS" ]; then
    fail_check "Missing required vars in $ENV_FILE:$MISSING_VARS"
  else
    pass_check "All required env vars present"
  fi
fi

# ============================================================================
# CHECK 9: Bun binary is real (not a symlink into /root — breaks ProtectHome)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Bun binary..."
BUN_PATH=$(command -v bun 2>/dev/null || echo "")
if [ -z "$BUN_PATH" ]; then
  fail_check "bun not found in PATH"
elif [ -L "$BUN_PATH" ]; then
  BUN_TARGET=$(readlink -f "$BUN_PATH")
  if [[ "$BUN_TARGET" == /root/* || "$BUN_TARGET" == /home/* ]]; then
    fail_check "bun at $BUN_PATH is a symlink to $BUN_TARGET — systemd ProtectHome=yes will block it. Fix: cp $BUN_TARGET $BUN_PATH"
  else
    pass_check "bun at $BUN_PATH (symlink to $BUN_TARGET)"
  fi
else
  BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
  pass_check "bun $BUN_VERSION at $BUN_PATH (real binary)"
fi

# ============================================================================
# CHECK 10: node_modules exists and not corrupted
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] node_modules..."
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  fail_check "node_modules missing — run: bun install"
elif [ ! -f "$PROJECT_ROOT/node_modules/.package-lock.json" ] && [ ! -d "$PROJECT_ROOT/node_modules/.cache" ]; then
  # Basic sanity: at least some marker that install completed
  # Check for a known critical dep
  if [ ! -d "$PROJECT_ROOT/node_modules/next" ]; then
    fail_check "node_modules exists but 'next' package missing — run: bun install"
  else
    pass_check "node_modules present"
  fi
else
  pass_check "node_modules present"
fi

# ============================================================================
# CHECK 11: Orphaned build processes (past crashes leave zombies that eat RAM)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Orphaned build processes..."
ORPHANS=$(pgrep -af "make|ship|build-and-serve|turbo.*build|next build" | grep -v "^$$ " || true)
if [ -n "$ORPHANS" ]; then
  ORPHAN_COUNT=$(printf '%s\n' "$ORPHANS" | wc -l)
  fail_check "$ORPHAN_COUNT orphaned build process(es) found — kill them first:\n$ORPHANS"
else
  pass_check "No orphaned build processes"
fi

# ============================================================================
# CHECK 12: Caddy is running (reverse proxy for all domains)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Caddy reverse proxy..."
if systemctl is-active caddy >/dev/null 2>&1; then
  pass_check "Caddy is running"
else
  fail_check "Caddy is not running — no traffic can reach the app"
fi

# ============================================================================
# CHECK 13: alive-api service (deploy script calls it to insert builds)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] alive-api service..."
API_STATUS=$(systemctl is-active alive-api 2>/dev/null || echo "inactive")
if [ "$API_STATUS" = "active" ]; then
  API_HEALTH=$(curl -sf "$DEPLOY_API_URL/health" 2>/dev/null | jq -r '.ok // false' 2>/dev/null || echo "false")
  if [ "$API_HEALTH" = "true" ]; then
    pass_check "alive-api running and healthy"
  else
    fail_check "alive-api running but health check failed"
  fi
else
  fail_check "alive-api is $API_STATUS — deploy script cannot insert builds"
fi

# ============================================================================
# CHECK 14: alive-deployer service (picks up and executes builds)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] alive-deployer service..."
DEPLOYER_STATUS=$(systemctl is-active alive-deployer 2>/dev/null || echo "inactive")
if [ "$DEPLOYER_STATUS" = "active" ]; then
  DEPLOYER_HEALTH=$(curl -sf "$DEPLOY_DEPLOYER_URL$DEPLOY_HEALTH_PATH" 2>/dev/null || echo "{}")
  DEPLOYER_OK=$(printf '%s' "$DEPLOYER_HEALTH" | jq -r "$DEPLOYER_JQ_OK // false" 2>/dev/null || echo "false")
  DEPLOYER_WORKER=$(printf '%s' "$DEPLOYER_HEALTH" | jq -r "$DEPLOYER_JQ_WORKER_STATUS // \"unknown\"" 2>/dev/null || echo "unknown")
  if [ "$DEPLOYER_OK" = "true" ]; then
    if [ "$DEPLOYER_WORKER" = "$DEPLOYER_WORKER_IDLE" ]; then
      pass_check "alive-deployer running, worker idle"
    elif [ "$DEPLOYER_WORKER" = "$DEPLOYER_WORKER_ERROR" ]; then
      LAST_ERR=$(printf '%s' "$DEPLOYER_HEALTH" | jq -r "$DEPLOYER_JQ_WORKER_LAST_ERROR // \"unknown\"" 2>/dev/null)
      fail_check "alive-deployer worker in error state: $LAST_ERR"
    else
      fail_check "alive-deployer worker is busy ($DEPLOYER_WORKER) — wait for it to finish"
    fi
  else
    fail_check "alive-deployer running but health check failed"
  fi
else
  fail_check "alive-deployer is $DEPLOYER_STATUS — builds will never be picked up"
fi

# ============================================================================
# CHECK 15: Stale deploy lock
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Deploy lock..."
LOCK_FILE="/tmp/alive-deploy.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE_SEC=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE") ))
  LOCK_AGE_MIN=$(( LOCK_AGE_SEC / 60 ))
  if [ "$LOCK_AGE_SEC" -gt 1800 ]; then
    fail_check "Stale deploy lock (${LOCK_AGE_MIN} min old) — likely orphaned. Remove: rm $LOCK_FILE"
  else
    # Fresh lock = another deploy is probably running
    fail_check "Deploy lock held (${LOCK_AGE_MIN} min old) — another deploy may be running"
  fi
else
  pass_check "No deploy lock"
fi

# ============================================================================
# CHECK 16: Postgres connectivity (deploy script polls via psql)
# ============================================================================
CHECK=$((CHECK + 1))
echo "[$CHECK/$TOTAL_CHECKS] Postgres connectivity..."
DB_URL_FROM_ENV=$(grep '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
DB_PW_FROM_ENV=$(grep '^DATABASE_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
if [ -n "$DB_URL_FROM_ENV" ] && [ -n "$DB_PW_FROM_ENV" ]; then
  if PGPASSWORD="$DB_PW_FROM_ENV" psql "$DB_URL_FROM_ENV" -c "SELECT 1;" >/dev/null 2>&1; then
    pass_check "Postgres reachable"
  else
    fail_check "Cannot connect to Postgres at $DB_URL_FROM_ENV"
  fi
else
  warn_check "DATABASE_URL or DATABASE_PASSWORD not in $ENV_FILE — skipping connectivity check"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "========================================="

if [ $ISSUES -eq 0 ]; then
  echo "ALL $TOTAL_CHECKS CHECKS PASSED — ready for deployment"
  echo "========================================="
  exit 0
else
  echo "$ISSUES ISSUE(S) FOUND — fix before deployment"
  echo "========================================="
  exit 1
fi
