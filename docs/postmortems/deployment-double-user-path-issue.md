# Postmortem: Double `/user/user` Path Issue in Website Deployment

**Date**: October 25, 2025
**Incident**: New website deployments creating incorrect PM2 working directory paths
**Duration**: ~1 hour
**Status**: Resolved

## Summary

When deploying new websites using the `deploy-site.sh` script, PM2 processes were starting with incorrect working directories containing double `/user/user` paths instead of the expected `/user` path. This caused services to fail with "connection refused" errors despite appearing as "online" in PM2.

## Timeline

1. **Initial Deployment**: `kranazilie.nl` deployed successfully through script
2. **Service Failure**: Site unreachable, Caddy logs showing "connection refused" to port 3339
3. **SSL Certificate Issues**: Unrelated apple.com SSL errors masking the real problem
4. **PM2 Investigation**: Process showed as online but with wrong working directory
5. **Root Cause Discovery**: PM2 executing from `/user/` directory, resolving `./user` to `/user/user`
6. **Resolution**: Fixed deployment script execution order and config generation

## Root Cause

### Primary Issue
The deployment script was executing `pm2 start` from the wrong directory, causing relative path resolution to create double `/user/user` paths.

**Execution Flow Problem:**
```bash
# Line 125: cd to /sites/domain/user/ for build
cd "$SITE_DIR/user"
bun install
bun run build

# Line 169: pm2 start still in /user/ directory
pm2 start "$ECOSYSTEM_CONFIG"  # ❌ Wrong directory context
```

When PM2 reads `cwd: './user'` from this context, it resolves to:
- Current directory: `/root/webalive/sites/kranazilie.nl/user/`
- Relative path: `./user`
- **Result**: `/root/webalive/sites/kranazilie.nl/user/user/` ❌

### Evidence
```bash
$ pm2 show kranazilie-nl
│ exec cwd  │ /root/webalive/sites/kranazilie.nl/user/user │ ❌
```

Expected:
```bash
│ exec cwd  │ /root/webalive/sites/kranazilie.nl/user │ ✅
```

## What Went Wrong

### Code Issues

#### 1. Directory Context Problem
```bash
# deploy-site.sh - Original problematic flow
cd "$SITE_DIR"                    # Line 98: /sites/domain/
bun run scripts/generate-config.js
cd "$SITE_DIR/user"              # Line 125: /sites/domain/user/
bun install && bun run build
pm2 start "$ECOSYSTEM_CONFIG"    # Line 169: Still in /user/ - WRONG!
```

#### 2. Relative Path in Config
```javascript
// ecosystem.config.js - Generated config
cwd: './user'  // Relative path causing double resolution
```

### Process Issues
- No validation of final PM2 working directory
- Build and deployment steps mixed directory contexts
- SSL errors from apple.com masked the real connection issue

## What Went Right

### Quick Detection
- Clear "connection refused" errors in Caddy logs
- PM2 showed process as "online" but service still failed
- Systematic debugging approach identified directory mismatch

### Proper Investigation
- Checked PM2 process details with `pm2 show`
- Verified service response with `curl localhost:3339`
- Traced deployment script execution flow

## Resolution

### 1. Fixed Deployment Script Directory Context
```bash
# deploy-site.sh - Fixed version
cd "$SITE_DIR/user"              # Build in correct directory
bun install && bun run build
cd "$SITE_DIR"                   # ✅ Return to site root before PM2
pm2 start "$ECOSYSTEM_CONFIG"    # Now resolves paths correctly
```

### 2. Updated Config Generator for Absolute Paths
```javascript
// generate-config.js - Before
cwd: './user'

// generate-config.js - After
cwd: '${path.join(workDir, 'user')}'  // Absolute path
```

### 3. Removed Unrelated SSL Issues
- Removed apple.com from Caddyfile (can't get SSL for Apple's domain)
- Cleaned up Caddy logs to focus on real issues

## Prevention Measures

### 1. Deployment Script Hardening
- Added explicit `cd "$SITE_DIR"` before PM2 start
- Ensures consistent directory context for PM2 execution
- Comments explaining directory context changes

### 2. Config Generation Improvements
- Use absolute paths in ecosystem.config.js
- Eliminates dependency on execution directory
- More predictable PM2 behavior

### 3. Enhanced Validation
```bash
# Future addition - validate PM2 working directory
PM2_INFO=$(pm2 show "$PM2_NAME")
if echo "$PM2_INFO" | grep -q "user/user"; then
    echo "❌ Double user path detected"
    exit 10
fi
```

## Testing Verification

The fix was validated by:
1. Completely removing kranazilie.nl (PM2, Caddyfile, directory)
2. Re-deploying using fixed script
3. Verifying correct working directory: `/root/webalive/sites/kranazilie.nl/user` ✅
4. Confirming service responds on port 3339

## Lessons Learned

### Technical
1. **Directory context matters for PM2** - Relative paths resolved from current directory
2. **Absolute paths prevent context issues** - More reliable than relative paths
3. **Build and deployment should be separate phases** - Clear directory context per phase
4. **Always validate final PM2 configuration** - Check actual working directory

### Process
1. **Unrelated errors can mask real issues** - SSL errors distracted from path problem
2. **Systematic debugging works** - Check process details, not just status
3. **End-to-end testing is crucial** - Full redeploy revealed the actual fix

### Monitoring
1. **PM2 process details are essential** - Status "online" doesn't mean correctly configured
2. **Service health checks needed** - Port response validation should be automated
3. **Path validation in deployment** - Detect double-path patterns early

## Action Items

- [x] Fix deployment script directory context
- [x] Update config generator to use absolute paths
- [x] Test full redeploy of kranazilie.nl
- [x] Verify correct PM2 working directory
- [x] Document this postmortem
- [ ] Add automated validation for double-path detection
- [ ] Implement health checks in deployment script
- [ ] Consider adding PM2 working directory validation

## Future Considerations

### Monitoring
- Add alerts for services showing "online" but not responding
- Monitor PM2 working directory patterns for anomalies
- Implement automated health checks post-deployment

### Deployment Robustness
- Add more validation steps in deployment script
- Consider containerization to eliminate path context issues
- Implement rollback mechanism for failed deployments

### Documentation
- Update deployment documentation with directory context notes
- Add troubleshooting guide for PM2 path issues
- Document the importance of absolute vs relative paths

---

**Key Takeaway**: Directory context matters when PM2 resolves relative paths. Always ensure deployment scripts maintain consistent directory context and prefer absolute paths in configuration files to prevent path resolution issues.