#!/bin/bash
# Pre-deployment safety checks
# Run this BEFORE attempting any deployment to catch issues early

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENVIRONMENT="${1:-staging}"
VERBOSE="${2:-0}"

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "Usage: $0 [staging|production] [verbose]"
  exit 1
fi

case "$ENVIRONMENT" in
  staging)
    SERVICE="alive-staging"
    PORT=8998
    ;;
  production)
    SERVICE="alive-production"
    PORT=9000
    ;;
esac

CONTAINER_NAME="alive-control-alive-$ENVIRONMENT"
RUNTIME_KIND="systemd"
REDIS_ENV_FILE="$PROJECT_ROOT/apps/web/.env.$ENVIRONMENT"

if [ ! -f "$REDIS_ENV_FILE" ]; then
  REDIS_ENV_FILE="$PROJECT_ROOT/apps/web/.env.production"
fi

REDIS_PASSWORD=""
if [ -f "$REDIS_ENV_FILE" ]; then
  REDIS_URL=$(grep '^REDIS_URL=' "$REDIS_ENV_FILE" | cut -d= -f2- || true)
  REDIS_PASSWORD=$(printf '%s' "$REDIS_URL" | sed -n 's#redis://:\([^@]*\)@.*#\1#p')
fi

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  RUNTIME_KIND="docker"
fi

redis_persistence_ok() {
  # Check if Redis is reachable (may run via systemd or Docker)
  REDIS_PING=$(REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h 127.0.0.1 -p 6379 PING 2>/dev/null || true)
  if [ "$REDIS_PING" != "PONG" ]; then
    echo "Redis not reachable on 127.0.0.1:6379 (neither systemd nor Docker)"
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

echo "========================================="
echo "🔍 PRE-DEPLOYMENT CHECKS: $ENVIRONMENT"
echo "========================================="
echo ""

ISSUES=0

# ============================================================================
# CHECK 1: Runtime target exists and is healthy
# ============================================================================

echo "[1/7] Checking runtime target..."
if [ "$RUNTIME_KIND" = "docker" ]; then
  STATUS=$(docker inspect --format '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
  echo "  ✅ Docker container exists: $CONTAINER_NAME ($STATUS)"
else
  if systemctl list-unit-files | grep -q "^${SERVICE}.service"; then
    STATUS=$(systemctl is-active "$SERVICE" 2>/dev/null || echo "unknown")
    echo "  ✅ Systemd unit exists: $SERVICE ($STATUS)"
    if [ "$STATUS" = "failed" ]; then
      echo "  ⚠️  WARNING: Service is in failed state"
      echo "  Run: systemctl reset-failed $SERVICE"
      ISSUES=$((ISSUES + 1))
    fi
  else
    echo "  ❌ No Docker container and no systemd unit found for $ENVIRONMENT"
    ISSUES=$((ISSUES + 1))
    STATUS="missing"
  fi
fi

# ============================================================================
# CHECK 2: Redis health and persistence
# ============================================================================

echo "[2/7] Checking Redis health..."
if REDIS_RESULT=$(redis_persistence_ok); then
  echo "  ✅ $REDIS_RESULT"
else
  echo "  ❌ CRITICAL: $REDIS_RESULT"
  ISSUES=$((ISSUES + 1))
fi

# ============================================================================
# CHECK 3: Port availability
# ============================================================================

echo "[3/7] Checking port $PORT availability..."
if ss -ltn "( sport = :$PORT )" | grep -q LISTEN; then
  echo "  ✅ Port $PORT is in use ($RUNTIME_KIND runtime responding)"
else
  if [ "$STATUS" = "active" ]; then
    echo "  ⚠️  WARNING: Service is 'active' but port $PORT is not listening"
    echo "  This might indicate a startup failure"
    ISSUES=$((ISSUES + 1))
  elif [ "$STATUS" = "running" ]; then
    echo "  ⚠️  WARNING: Container is 'running' but port $PORT is not listening"
    ISSUES=$((ISSUES + 1))
  else
    echo "  ✅ Port $PORT is available"
  fi
fi

# ============================================================================
# CHECK 4: Disk space
# ============================================================================

echo "[4/7] Checking disk space..."
BUILD_DIR="$PROJECT_ROOT/.builds/$ENVIRONMENT"
MIN_FREE_GB=15
MIN_FREE_PERCENT=10

# Guard against missing build directory
if [[ ! -d "$BUILD_DIR" ]]; then
  echo "  ⚠️  Build directory not yet created: $BUILD_DIR"
  DISK_FREE_KB=$(df -k "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
  DISK_FREE_PERCENT=$(df "$PROJECT_ROOT" | awk 'NR==2 {print 100 - substr($5, 1, length($5)-1)}')
else
  DISK_FREE_KB=$(df -k "$BUILD_DIR" | awk 'NR==2 {print $4}')
  DISK_FREE_PERCENT=$(df "$BUILD_DIR" | awk 'NR==2 {print 100 - substr($5, 1, length($5)-1)}')
fi

DISK_FREE_GB=$(awk "BEGIN {printf \"%.1f\", $DISK_FREE_KB / 1024 / 1024}")

if awk "BEGIN {exit !($DISK_FREE_GB >= $MIN_FREE_GB || $DISK_FREE_PERCENT >= $MIN_FREE_PERCENT)}"; then
  echo "  ✅ Disk free space OK (${DISK_FREE_GB}GiB, ${DISK_FREE_PERCENT}% free)"
else
  echo "  ❌ CRITICAL: Low disk headroom (${DISK_FREE_GB}GiB, ${DISK_FREE_PERCENT}% free)"
  echo "  Require at least ${MIN_FREE_GB}GiB free or ${MIN_FREE_PERCENT}% free before deployment"
  ISSUES=$((ISSUES + 1))
fi

# ============================================================================
# CHECK 5: Memory available
# ============================================================================

echo "[5/7] Checking available memory..."
MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')

if [ "$MEM_AVAILABLE" -lt 500 ]; then
  echo "  ❌ CRITICAL: Available memory is ${MEM_AVAILABLE}MB (< 500MB)"
  echo "  Run: systemctl status and check running services"
  ISSUES=$((ISSUES + 1))
elif [ "$MEM_AVAILABLE" -lt 1000 ]; then
  echo "  ⚠️  WARNING: Available memory is ${MEM_AVAILABLE}MB (< 1GB)"
else
  echo "  ✅ Available memory OK (${MEM_AVAILABLE}MB)"
fi

# ============================================================================
# CHECK 6: Health endpoint
# ============================================================================

echo "[6/7] Checking health endpoint..."
HEALTH_ENDPOINT="http://localhost:$PORT/api/health"

if curl -sf "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
  echo "  ✅ Health endpoint responding"
else
  if [ "$STATUS" = "active" ] || [ "$STATUS" = "running" ]; then
    echo "  ⚠️  WARNING: Health endpoint not responding (runtime may be starting or unhealthy)"
  else
    echo "  ℹ️  Runtime not running (health check skipped)"
  fi
fi

# ============================================================================
# CHECK 7: Build directory structure
# ============================================================================

echo "[7/7] Checking build directory structure..."
if [ -d "$BUILD_DIR" ]; then
  STANDALONE_DIR="$BUILD_DIR/standalone"
  if [ -d "$STANDALONE_DIR" ]; then
    echo "  ✅ Build structure OK (standalone at $STANDALONE_DIR)"
  else
    echo "  ℹ️  No existing standalone dir at $STANDALONE_DIR (will be created on first deploy)"
  fi
else
  echo "  ℹ️  Build directory $BUILD_DIR will be created on first deploy"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "========================================="

if [ $ISSUES -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED - Ready for deployment"
  echo "========================================="
  exit 0
else
  echo "❌ $ISSUES ISSUE(S) FOUND - Fix before deployment"
  echo "========================================="
  exit 1
fi
