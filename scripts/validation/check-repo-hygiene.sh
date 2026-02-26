#!/bin/bash
# Repo hygiene: stop AI and humans from committing junk
# Catches: binary images, wrong lock files, database files, compiled binaries,
#          local config, root file sprawl, directory sprawl, misplaced migrations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

cd "$PROJECT_ROOT"

ERRORS=()

# Helper: check git ls-files against a ban list
check_banned() {
    local label="$1"
    local fix="$2"
    shift 2
    local patterns=("$@")

    local found=()
    for pattern in "${patterns[@]}"; do
        while IFS= read -r file; do
            [[ -z "$file" ]] && continue
            found+=("$file")
        done < <(git ls-files "$pattern" 2>/dev/null || true)
    done

    if [ ${#found[@]} -gt 0 ]; then
        ERRORS+=("$label")
        for file in "${found[@]}"; do
            ERRORS+=("  ✗ $file")
        done
        ERRORS+=("  → $fix")
        ERRORS+=("")
    fi
}

# ─── Check 1: No binary image files ───
check_banned \
    "BANNED IMAGE FILES in git:" \
    "git rm --cached <file>. Images belong in external storage." \
    '*.png' '*.jpg' '*.jpeg' '*.gif' '*.bmp' '*.webp'

# ─── Check 2: No wrong lock files (we use bun) ───
check_banned \
    "WRONG LOCK FILES in git (we use bun):" \
    "git rm --cached <file>. Only bun.lock belongs in this repo." \
    '**/package-lock.json' '**/yarn.lock' '**/pnpm-lock.yaml'

# ─── Check 3: No database/binary data files ───
check_banned \
    "DATABASE FILES in git:" \
    "git rm --cached <file>. Database files are runtime data, not source." \
    '*.db' '*.sqlite' '*.sqlite3' '*.db-wal' '*.db-shm'

# ─── Check 4: No compiled binaries ───
# Go/Rust build output should be built on deploy, not committed.
# Detection: extensionless files in dirs with go.mod/Cargo.toml, verified via `file` command.
BANNED=()
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    [[ "$file" == *"/"* ]] || continue
    local_dir=$(dirname "$file")
    base=$(basename "$file")
    # Skip if it has an extension (Makefile, README, LICENSE, etc. are fine)
    [[ "$base" == *.* ]] && continue
    # Skip known non-binary extensionless files
    [[ "$base" == "Makefile" || "$base" == "Dockerfile" || "$base" == "LICENSE" || "$base" == "README" || "$base" == "CHANGELOG" ]] && continue
    # Check if directory has go.mod or Cargo.toml (compiled project)
    if git ls-files "$local_dir/go.mod" "$local_dir/Cargo.toml" 2>/dev/null | grep -q .; then
        # Verify it's actually a binary (not a script)
        if [ -f "$file" ] && file "$file" | grep -qE 'ELF|Mach-O|executable'; then
            BANNED+=("$file")
        elif [ ! -f "$file" ]; then
            # File tracked in git but not on disk — still flag it
            BANNED+=("$file (tracked but missing on disk)")
        fi
    fi
done < <(git ls-files 2>/dev/null)

if [ ${#BANNED[@]} -gt 0 ]; then
    ERRORS+=("COMPILED BINARIES in git:")
    for file in "${BANNED[@]}"; do
        ERRORS+=("  ✗ $file")
    done
    ERRORS+=("  → Build on deploy, don't commit binaries. Add to .gitignore.")
    ERRORS+=("")
fi

# ─── Check 5: No settings.local.json (machine-specific) ───
check_banned \
    "LOCAL CONFIG FILES in git:" \
    "git rm --cached <file>. Local settings are machine-specific." \
    '**/settings.local.json'

# ─── Check 6: No migrations outside packages/database/migrations/ ───
MISPLACED=()
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    # Allow packages/database/migrations/ and scripts/database/
    [[ "$file" == packages/database/migrations/* ]] && continue
    [[ "$file" == scripts/database/* ]] && continue
    MISPLACED+=("$file")
done < <(git ls-files '*.sql' 2>/dev/null || true)

if [ ${#MISPLACED[@]} -gt 0 ]; then
    ERRORS+=("MISPLACED SQL MIGRATIONS:")
    for file in "${MISPLACED[@]}"; do
        ERRORS+=("  ✗ $file")
    done
    ERRORS+=("  → Migrations belong in packages/database/migrations/ (numbered: 0001_name.sql)")
    ERRORS+=("")
fi

# ─── Check 7: Strict root .md allowlist ───

ALLOWED_ROOT_MD=(
    "AGENTS.md"
    "CLAUDE.md"
    "LICENSE_EE.md"
    "README.md"
)

UNEXPECTED=()
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    match=false
    for allowed in "${ALLOWED_ROOT_MD[@]}"; do
        [[ "$file" = "$allowed" ]] && match=true && break
    done
    [[ "$match" = false ]] && UNEXPECTED+=("$file")
done < <(git ls-files '*.md' 2>/dev/null | grep -v '/' || true)

if [ ${#UNEXPECTED[@]} -gt 0 ]; then
    ERRORS+=("UNEXPECTED .md files at repo root:")
    for file in "${UNEXPECTED[@]}"; do
        ERRORS+=("  ✗ $file")
    done
    ERRORS+=("  → Allowed: ${ALLOWED_ROOT_MD[*]}. Move to docs/.")
    ERRORS+=("")
fi

# ─── Check 8: Strict root file allowlist ───
# AI loves to create random files at root. Lock it down.

ALLOWED_ROOT_FILES=(
    # Documentation
    "AGENTS.md"
    "CLAUDE.md"
    "LICENSE"
    "LICENSE_EE.md"
    "README.md"
    # Build & config
    "biome.json"
    "bun.lock"
    "conductor.json"
    "knip.json"
    "Makefile"
    "package.json"
    "renovate.json"
    "tsconfig.base.json"
    "tsconfig.json"
    "turbo.json"
)

UNEXPECTED=()
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    # Skip dotfiles (handled by their own conventions)
    [[ "$file" == .* ]] && continue
    match=false
    for allowed in "${ALLOWED_ROOT_FILES[@]}"; do
        [[ "$file" = "$allowed" ]] && match=true && break
    done
    [[ "$match" = false ]] && UNEXPECTED+=("$file")
done < <(git ls-files 2>/dev/null | grep -v '/')

if [ ${#UNEXPECTED[@]} -gt 0 ]; then
    ERRORS+=("UNEXPECTED files at repo root:")
    for file in "${UNEXPECTED[@]}"; do
        ERRORS+=("  ✗ $file")
    done
    ERRORS+=("  → Root is for essential config only. Move code to apps/ or packages/.")
    ERRORS+=("")
fi

# ─── Check 9: No top-level directories outside allowed set ───

ALLOWED_DIRS=(
    "apps"
    "config"
    "docs"
    "ops"
    "packages"
    "patches"
    "scripts"
    "templates"
)

UNEXPECTED=()
while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    [[ "$dir" == .* ]] && continue
    match=false
    for allowed in "${ALLOWED_DIRS[@]}"; do
        [[ "$dir" = "$allowed" ]] && match=true && break
    done
    [[ "$match" = false ]] && UNEXPECTED+=("$dir/")
done < <(git ls-files 2>/dev/null | grep '/' | cut -d/ -f1 | sort -u)

if [ ${#UNEXPECTED[@]} -gt 0 ]; then
    ERRORS+=("UNEXPECTED top-level directories:")
    for dir in "${UNEXPECTED[@]}"; do
        ERRORS+=("  ✗ $dir")
    done
    ERRORS+=("  → Allowed: ${ALLOWED_DIRS[*]}. Use existing structure.")
    ERRORS+=("")
fi

# ─── Report ───

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo -e "${RED}REPO HYGIENE: Issues found!${NC}"
    echo ""
    for line in "${ERRORS[@]}"; do
        echo -e "  ${RED}$line${NC}"
    done
    exit 1
fi

echo -e "${GREEN}✓ Repo hygiene clean (9 checks passed)${NC}"
exit 0
