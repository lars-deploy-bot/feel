# @webalive/site-controller

Shell-Operator Pattern implementation for website deployment.

## Architecture

**Philosophy:**
- **Node.js (Brain)**: Auth, DB, State, Error Handling, Orchestration
- **Bash (Hands)**: Filesystem, Permissions, Users, systemd
- **Contract**: Node calls Bash scripts as atomic, idempotent functions

## Features

- **Atomic Operations**: Each script is idempotent and can be safely retried
- **Sequential Execution**: 7-phase deployment with clear error boundaries
- **Automatic Rollback**: Failed deployments trigger cleanup automatically
- **Type-Safe**: Full TypeScript support with strict types
- **Process Isolation**: Each site runs as dedicated system user via systemd
- **Zero-Downtime Updates**: Caddy hot-reload for configuration changes

## Installation

```bash
cd packages/site-controller
bun install
bun run build
```

## Usage

### Basic Deployment

```typescript
import { SiteOrchestrator } from '@webalive/site-controller'

const result = await SiteOrchestrator.deploy({
  domain: 'example.com',
  slug: 'example-com',
  templatePath: '/path/to/template',
})

if (result.success) {
  console.log(`Deployed to https://${result.domain} on port ${result.port}`)
} else {
  console.error(`Deployment failed: ${result.error}`)
}
```

### Teardown Site

```typescript
await SiteOrchestrator.teardown('example.com', {
  removeUser: false,  // Keep system user
  removeFiles: false, // Keep files
})
```

### Advanced: Individual Executors

```typescript
import { validateDns, assignPort, buildSite } from '@webalive/site-controller'

// Validate DNS before deployment
const dns = await validateDns({
  domain: 'example.com',
  serverIp: '138.201.56.93',
  wildcardDomain: '*.alive.best',
})

// Assign port
const { port } = await assignPort({
  domain: 'example.com',
  registryPath: '/var/lib/claude-bridge/domain-passwords.json',
})

// Build site
await buildSite({
  user: 'site-example-com',
  domain: 'example.com',
  port: 3333,
  slug: 'example-com',
  targetDir: '/srv/webalive/sites/example.com',
  envFilePath: '/etc/sites/example-com.env',
})
```

## Deployment Phases

### Phase 1: DNS Validation (`00-validate-dns.sh`)
- Checks A record points to correct server IP
- Detects Cloudflare proxy (rejects)
- Skips validation for wildcard domains

**Exit codes:**
- `0`: DNS valid
- `12`: DNS misconfigured

### Phase 2: Port Assignment (`00-assign-port.sh`)
- Reads from domain-passwords.json registry
- Returns existing port or assigns new (3333-3999 range)
- Atomic write with conflict detection

### Phase 3: User Creation (`01-ensure-user.sh`)
- Creates system user `site-{slug}` if not exists
- Idempotent (safe to run multiple times)

### Phase 4: Filesystem Setup (`02-setup-fs.sh`)
- Creates `/srv/webalive/sites/{domain}/`
- Migrates from legacy location if exists
- Copies from template if new site
- Sets ownership and permissions

### Phase 5: Build (`03-build-site.sh`)
- Creates systemd environment file
- Runs `bun install` as site user
- Runs `bun run build` if package.json has build script
- Fixes ownership after build

### Phase 6: Service Start (`04-start-service.sh`)
- Stops old PM2 process (if migrating)
- Starts systemd service `site@{slug}.service`
- Verifies port is listening (with retries)

**Exit codes:**
- `0`: Service started successfully
- `15`: Service failed to start
- `16`: Port not listening

### Phase 7: Caddy Configuration (`05-caddy-inject.sh`)
- Acquires flock on Caddyfile
- Updates or creates domain block
- Reloads Caddy with zero downtime

**Exit codes:**
- `0`: Caddy configured successfully
- `17`: Failed to reload Caddy

## Rollback

The `99-teardown.sh` script handles cleanup:
- Stops and disables systemd service
- Removes from Caddy configuration
- Removes environment file
- Removes port from registry
- Optionally removes user and files

Rollback is **automatic on deployment failure** (configurable via `rollbackOnFailure`).

## Script Exit Codes

All scripts use distinct exit codes for different failures:

- `0`: Success
- `12`: DNS validation failed
- `13`: Dependency installation failed
- `14`: Build failed
- `15`: Service failed to start
- `16`: Port not listening
- `17`: Caddy reload failed

## Testing

```bash
# Run unit tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## Security

- All file operations use workspace validation
- Scripts run with minimal privileges
- systemd sandboxing via `ProtectSystem=strict`
- Flock prevents race conditions on shared files
- Atomic writes for registry updates

## Dependencies

- **Bun**: Runtime and package manager
- **systemd**: Process management
- **Caddy**: Reverse proxy
- **dig**: DNS validation
- **jq**: JSON manipulation in bash
- **flock**: File locking

## Contributing

When adding new scripts:
1. Use `set -e` for error handling
2. Source `lib/common.sh` for logging
3. Validate env vars with `require_var`
4. Make idempotent (check state first)
5. Use distinct exit codes
6. Add corresponding TypeScript executor

## License

MIT
