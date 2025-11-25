# 🛡️ Type Safety Checks - Quick Reference

## When to Use Each Check

| Command | What it Does | When to Use | Speed |
|---------|-------------|-------------|-------|
| `bun run check:quick` | TypeScript + Lint | Before committing | ~1 sec |
| `bun run check:pre-push` | Types + Lint + Format + Tests | Before pushing (auto-runs) | ~10 sec |
| `bun run check:comprehensive` | Everything + Dependencies | Weekly / Before releases | ~15 sec |
| `bun run check:all` | Runs all checks | CI / Major changes | ~30 sec |

## Individual Checks

```bash
bun run type-check    # Just TypeScript
bun run lint          # Just linting
bun run format        # Fix formatting
bun run test          # Just tests
bun run depcruise     # Dependency analysis
```

## Git Hooks (Automatic)

- **Pre-commit**: Formats staged files
- **Pre-push**: Runs `check:pre-push` automatically

## Emergency Override (Use Sparingly!)

```bash
git commit --no-verify   # Skip pre-commit
git push --no-verify     # Skip pre-push
```

## What Each Level Catches

### 🚀 Quick (check:quick)
- ❌ Type errors
- ❌ Lint violations

### 🛡️ Pre-Push (check:pre-push)
- ❌ Type errors
- ❌ Lint violations
- ❌ Format issues
- ❌ Failing tests

### 🔍 Comprehensive (check:comprehensive)
- ❌ All of the above
- ❌ Circular dependencies
- ❌ Broken symlinks
- ❌ Architecture violations
- ❌ Dead code (if enabled)

## Fix Common Issues

```bash
# Auto-fix most issues
bun run format && bun run lint

# See all TypeScript errors
bun run type-check

# Check what pre-push will run
bun run check:pre-push --dry-run
```

---
*Type errors will NEVER sneak through again! 🎯*