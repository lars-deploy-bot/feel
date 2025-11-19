# Integration Guide

## Using in Claude Bridge

### Import in API Routes

```typescript
// apps/web/app/api/deploy/route.ts
import { deploySite, DeploymentError } from "@alive-brug/deploy-scripts"

export async function POST(request: Request) {
  try {
    const { domain, email, password } = await request.json()

    const result = await deploySite({
      domain,
      email,
      password
    })

    return Response.json({
      success: true,
      domain: result.domain,
      port: result.port,
      serviceName: result.serviceName
    })
  } catch (error) {
    if (error instanceof DeploymentError) {
      return Response.json(
        { error: error.message },
        { status: 400 }
      )
    }
    throw error
  }
}
```

### Error Handling Patterns

```typescript
// Specific error handling
try {
  const result = await deploySite(config)
} catch (error) {
  if (error instanceof DeploymentError) {
    if (error.message.includes("DNS")) {
      // DNS validation failed - user needs to update A record
      return { error: "Invalid DNS configuration" }
    }
    if (error.message.includes("Port")) {
      // Port conflict - suggest trying again
      return { error: "Port unavailable, try again" }
    }
    // Generic deployment error
    return { error: error.message }
  }
  // Unexpected error
  throw error
}
```

## monorepo Build Integration

The library is automatically included in workspace builds:

```bash
# Build entire monorepo (includes deploy-scripts)
bun run build

# Build specific package
bun run build -F @alive-brug/deploy-scripts

# Verify it's in deps
grep "@alive-brug/deploy-scripts" apps/web/package.json
```

### TypeScript Configuration

Next.js has `transpilePackages` configured:

```javascript
// apps/web/next.config.js
module.exports = {
  transpilePackages: [
    "@alive-brug/deploy-scripts",
    "@alive-brug/tools",
    "@alive-brug/images",
    "@alive-brug/guides"
  ]
}
```

This allows importing TypeScript directly without pre-compilation.

## System Requirements

### Required for Deployments to Work

- Root access (systemd service management, user creation)
- systemd enabled (for process management)
- Caddy running (for reverse proxy)
- Template directory: `/root/webalive/packages/template/user`
- Registry file: `/var/lib/claude-bridge/domain-passwords.json` (auto-created)

### In Local Development

Deployments will fail without system setup, but:
- Library imports work fine
- Tests run without issues
- TypeScript compilation succeeds
- You can review code and make changes

## Debugging Deployments

### Check logs for specific step

```bash
# systemd service logs
journalctl -u site@example-com.service -n 50

# Caddy logs
journalctl -u caddy.service -n 50

# System user creation
id site-example-com

# Service status
systemctl status site@example-com.service

# Caddyfile
cat /root/webalive/claude-bridge/Caddyfile | grep example.com
```

### Verify registry

```bash
# Check port allocation
jq '.["example.com"]' /var/lib/claude-bridge/domain-passwords.json

# Check all sites
jq . /var/lib/claude-bridge/domain-passwords.json
```

## Upgrading the Library

When the library is updated:

1. **Test in dev** - Verify deployment works locally (if system permits)
2. **Review changes** - Check git diff for breaking changes
3. **Update integration** - Adjust API routes if signatures changed
4. **Rebuild monorepo** - `bun run build`
5. **Redeploy bridge** - Push changes to staging/production

### Breaking Changes

If `DeploymentConfig` or `DeploymentResult` changes:

1. Update interface imports
2. Update API route responses
3. Update error handling
4. Test deployment end-to-end

## Common Integration Issues

### Issue: "Cannot find module '@alive-brug/deploy-scripts'"

**Cause**: Turbopack can't find package

**Fix**:
```bash
# Ensure it's in transpilePackages
grep "@alive-brug/deploy-scripts" apps/web/next.config.js

# Rebuild
bun run build -F @alive-brug/deploy-scripts

# Clear cache and restart
rm -rf .next && bun run dev
```

### Issue: "Template not found"

**Cause**: Template directory missing or wrong path

**Fix**:
```bash
# Verify template exists
ls -la /root/webalive/packages/template/user/

# Check what deploySite expects
grep -n "templatePath" packages/deploy-scripts/src/files/directory.ts
```

### Issue: Deployment fails with "Port already in use"

**Cause**: Registry has stale entries or port conflict

**Fix**:
```bash
# Check registry
cat /var/lib/claude-bridge/domain-passwords.json

# Remove stale entry (carefully!)
# Then retry deployment
```

## Performance Tuning

### If deployments are slow:

1. **DNS validation** - Takes longest on slow networks
   - Check if DNS queries timeout
   - Consider skipping for trusted domains (Cloudflare)

2. **Dependency installation** - Large `package.json`
   - Pre-cache node_modules in template
   - Use lockfile instead of fresh install

3. **Build step** - Project-specific build time
   - Optimize source code
   - Use build caching if available

### Monitoring

Track deployment success rate:

```typescript
// In API route
const startTime = Date.now()
const result = await deploySite(config)
const duration = Date.now() - startTime

// Log for monitoring
console.log({
  domain: result.domain,
  success: true,
  duration,
  port: result.port
})
```

## Security Considerations

### Never Log

```typescript
// ✗ WRONG - password leak!
console.log(result)

// ✓ CORRECT
console.log({
  domain: result.domain,
  port: result.port,
  // Never log passwords or sensitive data
})
```

### Validate Before Deploy

```typescript
// ✓ CORRECT - validate early
if (!isValidEmail(email)) {
  throw new Error("Invalid email")
}
if (!isValidDomain(domain)) {
  throw new Error("Invalid domain")
}

const result = await deploySite({ domain, email })
```

### Rate Limit Deployments

```typescript
// Prevent deployment spam
const lastDeployment = new Map<string, number>()
const MIN_INTERVAL = 60000 // 1 minute

if (lastDeployment.has(userId)) {
  const timeSince = Date.now() - lastDeployment.get(userId)!
  if (timeSince < MIN_INTERVAL) {
    throw new Error("Deployment rate limited")
  }
}

const result = await deploySite(config)
lastDeployment.set(userId, Date.now())
```

## Testing Integration

### Mock the library for tests

```typescript
import { vi } from "vitest"
import * as deployScripts from "@alive-brug/deploy-scripts"

vi.mock("@alive-brug/deploy-scripts", () => ({
  deploySite: vi.fn().mockResolvedValue({
    domain: "test.com",
    port: 3333,
    serviceName: "site@test-com.service",
    siteUser: "site-test-com",
    siteDirectory: "/srv/webalive/sites/test.com",
    envFile: "/srv/webalive/sites/test.com/.env",
    success: true
  }),
  DeploymentError: Error
}))

// Now test without actual deployment
```

## Questions?

- Review `architecture.md` for design details
- Check `development.md` for code guidelines
- See `../README.md` for quick reference
