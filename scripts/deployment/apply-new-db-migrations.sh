#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENVIRONMENT="${1:-}"
PREVIOUS_GIT_SHA="${2:-}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Usage: $0 <staging|production> [previous_git_sha]" >&2
    exit 1
fi

CURRENT_GIT_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
MIGRATIONS_DIR="packages/database/migrations"

log() {
    printf '[db-migrations] %s\n' "$*"
}

if [[ -z "$PREVIOUS_GIT_SHA" ]]; then
    log "No previous deployed git SHA available for $ENVIRONMENT. Bootstrapping baseline; no migrations applied."
    exit 0
fi

if ! git -C "$PROJECT_ROOT" cat-file -e "${PREVIOUS_GIT_SHA}^{commit}" 2>/dev/null; then
    log "Previous git SHA $PREVIOUS_GIT_SHA is not present locally. Bootstrapping baseline; no migrations applied."
    exit 0
fi

if [[ "$PREVIOUS_GIT_SHA" == "$CURRENT_GIT_SHA" ]]; then
    log "Current git SHA already deployed; no migrations to apply."
    exit 0
fi

mapfile -t migration_changes < <(
    git -C "$PROJECT_ROOT" diff --name-status "$PREVIOUS_GIT_SHA" "$CURRENT_GIT_SHA" -- "$MIGRATIONS_DIR/*.sql" "$MIGRATIONS_DIR" \
        | awk '$2 ~ /^packages\\/database\\/migrations\\/.*\\.sql$/ { print }'
)

if [[ ${#migration_changes[@]} -eq 0 ]]; then
    log "No new repo migrations between $PREVIOUS_GIT_SHA and $CURRENT_GIT_SHA."
    exit 0
fi

unexpected_changes=()
pending_files=()

for line in "${migration_changes[@]}"; do
    status="$(printf '%s' "$line" | awk '{print $1}')"
    path="$(printf '%s' "$line" | awk '{print $2}')"

    case "$status" in
        A)
            pending_files+=("$path")
            ;;
        *)
            unexpected_changes+=("$line")
            ;;
    esac
done

if [[ ${#unexpected_changes[@]} -gt 0 ]]; then
    log "Historical migration files changed between deployed SHA and HEAD. Refusing to continue."
    printf '  %s\n' "${unexpected_changes[@]}" >&2
    exit 1
fi

if [[ ${#pending_files[@]} -eq 0 ]]; then
    log "Migration diff contained no newly added SQL files."
    exit 0
fi

IFS=$'\n' read -r -d '' -a sorted_files < <(printf '%s\n' "${pending_files[@]}" | sort -V && printf '\0')

log "Applying ${#sorted_files[@]} new migration(s) to $ENVIRONMENT:"
printf '  %s\n' "${sorted_files[@]}"

for relative_path in "${sorted_files[@]}"; do
    absolute_path="$PROJECT_ROOT/$relative_path"
    if [[ ! -f "$absolute_path" ]]; then
        log "Missing migration file: $absolute_path"
        exit 1
    fi

    log "Applying $(basename "$relative_path")"
    sql_args=(--target "$ENVIRONMENT" --file "$absolute_path" --tx)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        sql_args+=(--confirm-production-write)
    fi
    "$PROJECT_ROOT/scripts/database/sql.sh" "${sql_args[@]}"
done

log "All pending repo migrations applied to $ENVIRONMENT."
