# @alive-brug/deploy-scripts

**DO NOT use without reading docs first.** This library modifies system state (users, services, files).

## Quick Start

```typescript
import { deploySite, DeploymentError } from "@alive-brug/deploy-scripts"

const result = await deploySite({
  domain: "example.com",      // MUST be valid domain with DNS A record
  email: "admin@example.com",  // MUST be valid email
  password: "optional"
})
```

## Critical Requirements

**You MUST have:**
- ✓ Root access (systemd, user management)
- ✓ systemd enabled on system
- ✓ Caddy running and configured
- ✓ Template at `/root/webalive/packages/template/user`
- ✓ Writable `/var/lib/claude-bridge/domain-passwords.json`

**You MUST NOT:**
- ✗ Run concurrent deployments (causes port collision)
- ✗ Use invalid domains (will fail DNS validation)
- ✗ Share returned credentials without encryption
- ✗ Modify systemd services manually (registry will be inconsistent)
- ✗ Treat this as an atomic operation if using timeouts (may partially deploy)

## What This Does

1. Validates DNS (A record to server IP)
2. Allocates port (3333-3999)
3. Creates system user (site-example-com)
4. Copies template and builds project
5. Creates systemd service
6. Updates Caddy configuration
7. Starts and verifies service

## Return Value

```typescript
{
  domain: "example.com",
  port: 3333,
  serviceName: "site@example-com.service",
  siteUser: "site-example-com",
  siteDirectory: "/srv/webalive/sites/example.com",
  envFile: "/srv/webalive/sites/example.com/.env",
  success: true
}
```

## Error Handling

Throws `DeploymentError` on failure:

```typescript
try {
  await deploySite(config)
} catch (error) {
  if (error instanceof DeploymentError) {
    console.error(`Deployment failed: ${error.message}`)
  }
}
```

## Documentation

- `docs/architecture.md` - System design and deployment flow
- `docs/development.md` - Coding guidelines and testing
- `docs/integration.md` - How to use in Claude Bridge

## Testing

```bash
bun test
```

Tests do NOT modify system state.
