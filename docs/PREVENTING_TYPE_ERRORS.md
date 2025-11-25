# Preventing Type Errors - Multiple Defense Layers

## The Problem We Solved
Type errors were sneaking into production because the pre-push hook was calling a non-existent `static-check` script, causing developers to bypass it with `--no-verify`.

## Our Defense System

### 1. **Pre-Commit Hook** (First Line of Defense)
- **When**: Before every commit
- **What**: Formats staged files via lint-staged
- **Speed**: Instant (only touches staged files)
- **Location**: `.husky/pre-commit`

### 2. **Pre-Push Hook** (Second Line of Defense)
- **When**: Before pushing to remote
- **What**: Runs comprehensive checks via `bun run static-check`
  - Type checking (all packages)
  - Linting (all packages)
  - Formatting check
  - Unit tests
- **Speed**: 10-60 seconds (uses Turborepo cache)
- **Location**: `.husky/pre-push`

### 3. **Comprehensive Validation** (Deep Analysis)
- **When**: On demand or in CI
- **What**: Full static analysis via `bun run validate`
  - Workspace validation (circular deps, broken symlinks)
  - Linting (Biome)
  - Type checking (TypeScript)
  - Dependency architecture (depcruise)
  - Dead code detection (Knip - optional)
- **Location**: `scripts/validation/`

## Quick Commands (Clear Names!)

```bash
# QUICK: Just type-check and lint (fastest - ~1 second)
bun run check:quick

# PRE-PUSH: Type, lint, format + tests (~10 seconds)
bun run check:pre-push

# COMPREHENSIVE: Everything including dependency analysis (~15 seconds)
bun run check:comprehensive

# ALL: Runs all checks sequentially
bun run check:all

# Legacy names (still work):
bun run static-check    # Same as check:pre-push
make static-check        # Uses the legacy name
```

## If Checks Fail

### Type Errors
```bash
# See all type errors
bun run type-check

# Fix specific file
bunx tsc --noEmit path/to/file.ts
```

### Linting Issues
```bash
# Auto-fix most issues
bun run format && bun run lint
```

### Emergency Bypass (Use Carefully!)
```bash
# Skip pre-commit
git commit --no-verify

# Skip pre-push
git push --no-verify

# NEVER use these unless absolutely necessary!
```

## Configuration Files

- **Husky Hooks**: `.husky/pre-commit`, `.husky/pre-push`
- **Validation Config**: `scripts/validation/config.sh`
- **Lint Staged**: `package.json` → `lint-staged` section
- **TypeScript**: `tsconfig.json` files in each package

## Why This Works

1. **Early Detection**: Pre-commit catches issues immediately
2. **Enforcement**: Pre-push prevents bad code from reaching remote
3. **Caching**: Turborepo makes repeated checks fast
4. **Comprehensive**: Multiple layers catch different issues
5. **Configurable**: Can enable/disable specific checks in `config.sh`

## Monitoring

Check what will run:
```bash
# See enabled validation checks
cat scripts/validation/config.sh | grep "true"

# Test pre-push will pass
bun run static-check
```

## For CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs all these checks automatically on every PR, preventing merge if any fail.