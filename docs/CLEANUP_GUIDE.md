# Documentation Cleanup Guide

This guide outlines old/duplicate documentation that can be archived or removed.

## New Structure (Keep)

```
/docs/
├── README.md                      ✅ New documentation hub
├── GETTING_STARTED.md             ✅ Consolidated setup guide
├── architecture/                  ✅ Core architecture docs
│   ├── README.md
│   ├── workspace-isolation.md
│   ├── message-handling.md
│   ├── session-management.md
│   └── credits-and-tokens.md
├── security/                      ✅ Security documentation
│   ├── README.md
│   ├── authentication.md
│   ├── workspace-enforcement.md
│   └── systemd-hardening.md
├── testing/                       ✅ Testing guides
│   └── README.md
├── features/                      ✅ Feature docs
│   └── README.md
├── deployment/                    ✅ Deployment (minimal production refs)
│   └── README.md
├── troubleshooting/              ✅ Problems & solutions
│   └── README.md
└── archive/                       ✅ Keep for history
```

## Cleanup Actions

### Root Level - Move to Archive

These files can be moved to `/docs/archive/`:

```bash
# Move scattered root-level docs to archive
mv /root/webalive/claude-bridge/apps/web/BRIDGE_TYPING_AUDIT.md /root/webalive/claude-bridge/docs/archive/
```

### Duplicate Docs in apps/web/docs/ - Archive

The `/root/webalive/claude-bridge/apps/web/docs/` directory duplicates content now in `/root/webalive/claude-bridge/docs/`. Options:

**Option 1: Remove entirely** (recommended)
```bash
# Backup first
mv /root/webalive/claude-bridge/apps/web/docs /root/webalive/claude-bridge/docs/archive/apps-web-docs-backup

# Update any references to point to /docs instead
```

**Option 2: Create symlink**
```bash
# Remove old docs
rm -rf /root/webalive/claude-bridge/apps/web/docs

# Create symlink to main docs
ln -s ../../docs /root/webalive/claude-bridge/apps/web/docs
```

### Scattered Documentation - Consolidate or Archive

Move these to appropriate locations or archive:

```bash
# Architecture docs already consolidated
# These are duplicates:
/root/webalive/claude-bridge/apps/web/docs/architecture/*
→ Already in /root/webalive/claude-bridge/docs/architecture/

# Testing docs already consolidated
/root/webalive/claude-bridge/apps/web/docs/testing/*
→ Already in /root/webalive/claude-bridge/docs/testing/

# Security docs already consolidated
/root/webalive/claude-bridge/apps/web/docs/security/*
→ Already in /root/webalive/claude-bridge/docs/security/

# Feature docs
/root/webalive/claude-bridge/apps/web/docs/features/*
→ Reference from /root/webalive/claude-bridge/docs/features/README.md

# Database docs (Supabase migration notes)
/root/webalive/claude-bridge/apps/web/docs/database/*
→ Move to /root/webalive/claude-bridge/docs/archive/database-migration/

# Debugging docs
/root/webalive/claude-bridge/apps/web/docs/debugging/*
→ Move to /root/webalive/claude-bridge/docs/archive/debugging/

# Streaming docs
/root/webalive/claude-bridge/apps/web/docs/streaming/*
→ Consolidated into /root/webalive/claude-bridge/docs/architecture/message-handling.md
```

### Old Guide Docs - Move to Archive

```bash
# Old setup guides (superseded by GETTING_STARTED.md)
mv /root/webalive/claude-bridge/docs/guides/local-development-setup.md /root/webalive/claude-bridge/docs/archive/

# DNS validation (keep reference in features)
# Already documented in original location

# Hetzner images (infrastructure-specific)
# Keep in /root/webalive/claude-bridge/docs/guides/ (devops reference)

# Removing site guide
# Keep in /root/webalive/claude-bridge/docs/guides/ (operational)

# Workspace permission setup
# Keep in /root/webalive/claude-bridge/docs/guides/ (operational)

# Zustand patterns
# Keep in /root/webalive/claude-bridge/docs/guides/ (technical reference)
```

### Analysis Docs - Keep in Current Location

These are competitive analysis, keep in `/root/webalive/claude-bridge/docs/analysis/`:
- `claudable-comparison-neutral.md`
- `claudable-competitor-analysis.md`
- `claudable-vs-claude-bridge-critical-comparison.md`

### Package-Specific Docs - Keep

```bash
# Deploy scripts docs
/root/webalive/claude-bridge/packages/deploy-scripts/README.md
→ Keep (package documentation)

# Tools docs
/root/webalive/claude-bridge/packages/tools/
→ Keep (package documentation)

# Template docs
/root/webalive/claude-bridge/packages/template/user/CLAUDE.md
→ Keep (template instructions)
```

## Cleanup Script

```bash
#!/bin/bash

# Archive apps/web/docs duplicates
echo "Archiving duplicate docs from apps/web/docs..."
mkdir -p /root/webalive/claude-bridge/docs/archive/apps-web-docs-backup
cp -r /root/webalive/claude-bridge/apps/web/docs/* /root/webalive/claude-bridge/docs/archive/apps-web-docs-backup/

# Create symlink
rm -rf /root/webalive/claude-bridge/apps/web/docs
ln -s ../../docs /root/webalive/claude-bridge/apps/web/docs

echo "✓ apps/web/docs → symlink to /docs"

# Archive root-level scattered docs
echo "Archiving root-level docs..."
mv /root/webalive/claude-bridge/apps/web/BRIDGE_TYPING_AUDIT.md /root/webalive/claude-bridge/docs/archive/ 2>/dev/null || true
mv /root/webalive/claude-bridge/apps/web/docs/database /root/webalive/claude-bridge/docs/archive/database-migration 2>/dev/null || true
mv /root/webalive/claude-bridge/apps/web/docs/debugging /root/webalive/claude-bridge/docs/archive/debugging 2>/dev/null || true

echo "✓ Scattered docs archived"

# Clean up old setup guides
echo "Archiving superseded guides..."
mv /root/webalive/claude-bridge/docs/guides/local-development-setup.md /root/webalive/claude-bridge/docs/archive/ 2>/dev/null || true

echo "✓ Documentation cleanup complete!"
echo ""
echo "New structure: /root/webalive/claude-bridge/docs/"
echo "Archive: /root/webalive/claude-bridge/docs/archive/"
```

## Verification

After cleanup, verify:

```bash
# Check main docs structure
ls -la /root/webalive/claude-bridge/docs/

# Should show:
# - README.md (hub)
# - GETTING_STARTED.md
# - architecture/
# - security/
# - testing/
# - features/
# - deployment/
# - troubleshooting/
# - archive/

# Verify symlink
ls -la /root/webalive/claude-bridge/apps/web/docs
# Should show: docs -> ../../docs

# Check no broken references
grep -r "docs/setup" /root/webalive/claude-bridge/ --include="*.md"
# Should return nothing (old path)

grep -r "docs/GETTING_STARTED.md" /root/webalive/claude-bridge/ --include="*.md"
# Should show references to new path
```

## Notes

- Production deployment mentioned exactly **2 times** in deployment/README.md
- All docs consolidated by topic with intelligent nesting
- Archive preserves history without cluttering main docs
- Symlink maintains backward compatibility for any hardcoded paths

## Next Steps

1. Review this cleanup guide
2. Run cleanup script (or execute manually)
3. Test all documentation links
4. Update any hardcoded references
5. Remove `/docs/CLEANUP_GUIDE.md` after cleanup complete
