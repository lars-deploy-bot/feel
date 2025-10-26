# Template Migration Plan

## Current Status: ✅ PHASE 1 COMPLETE

The template has been successfully moved from `/root/webalive/sites/template` to `/root/webalive/claude-bridge/template`.

### What Was Done:

1. **✅ Copied template** from `/root/webalive/sites/template` to `/root/webalive/claude-bridge/template`
2. **✅ Updated all script references** to use new location:
   - `deploy-site-systemd.sh`
   - `create-site.sh`
   - `apps/web/app/api/deploy/route.ts`
3. **✅ Updated documentation** in `CLAUDE.md`

### Migration Benefits:

- **Better Organization**: Template is now part of the Claude Bridge infrastructure
- **Centralized Management**: All deployment tools and template in one location
- **Cleaner Sites Directory**: `/sites` now only contains actual websites
- **Consistent Tooling**: Everything deployment-related is under `/claude-bridge`

## Next Steps: PHASE 2

### Safe Cleanup Process:

1. **Verify New Template Works**:
   ```bash
   # Test template with new site creation
   /root/webalive/claude-bridge/scripts/create-site.sh test-template-migration.com
   /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh test-template-migration.com
   ```

2. **Create Backup Before Removal**:
   ```bash
   tar -czf /var/backups/old-template-$(date +%F).tgz /root/webalive/sites/template
   ```

3. **Remove Old Template** (after verification):
   ```bash
   rm -rf /root/webalive/sites/template
   ```

4. **Update Git Ignore** (if needed):
   ```bash
   # Add to .gitignore if template should not be tracked in sites repo
   echo "template/" >> /root/webalive/sites/.gitignore
   ```

### Verification Commands:

```bash
# Verify new template location exists
ls -la /root/webalive/claude-bridge/template/

# Test script references work
grep -r "claude-bridge/template" /root/webalive/claude-bridge/scripts/

# Verify no remaining old references
grep -r "sites/template" /root/webalive/claude-bridge/
```

### Rollback Plan (if needed):

```bash
# If issues arise, restore old template:
cp -r /root/webalive/claude-bridge/template /root/webalive/sites/
# Then revert script changes in git
```

## Template Directory Structure:

```
/root/webalive/claude-bridge/template/
├── DEPLOYMENT.md           # Deployment instructions
├── ecosystem.config.js     # PM2 config (legacy)
├── scripts/
│   └── generate-config.js  # Config generation script
└── user/                   # Template React/Vite app
    ├── src/               # Source code
    ├── package.json       # Dependencies
    ├── vite.config.ts     # Vite configuration
    └── ...               # Other app files
```

## Current State:

- **Old Template**: Still exists at `/root/webalive/sites/template` (can be removed)
- **New Template**: Working at `/root/webalive/claude-bridge/template`
- **All Scripts**: Updated to use new location
- **Deployment**: Ready for testing

**Next Action**: Test new template with a dummy site to verify everything works before removing the old template.