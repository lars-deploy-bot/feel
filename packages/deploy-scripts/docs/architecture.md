# Deploy Scripts Architecture

## Overview

`@alive-brug/deploy-scripts` is a modular TypeScript library that orchestrates secure site deployment on WebAlive infrastructure. It uses systemd for process management, Caddy for reverse proxying, and system users for isolation.

## Module Structure

```
src/
├── index.ts                 # Public API exports
├── orchestration/
│   ├── deploy.ts           # Main orchestration (18-step process)
│   ├── errors.ts           # Custom DeploymentError class
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # Shared utilities (delay, port checking)
├── dns/
│   └── validation.ts        # DNS validation and Cloudflare detection
├── ports/
│   └── registry.ts          # Port allocation and registry management
├── users/
│   └── system-user.ts       # System user creation and slug conversion
├── files/
│   └── directory.ts         # File operations (copy, ownership, symlinks)
├── caddy/
│   └── config.ts            # Caddyfile generation and updates
└── systemd/
    └── service.ts           # systemd service management
```

## Deployment Flow

The `deploySite()` function executes 18 steps:

1. **Validate input** - Check domain and email format
2. **Check DNS** - Verify A record points to server (skip if Cloudflare proxied)
3. **Allocate port** - Assign from 3333-3999 range, check availability
4. **Create system user** - Non-privileged user for site isolation
5. **Create site directory** - `/srv/webalive/sites/[domain]/`
6. **Copy template** - From `/root/webalive/packages/template/user`
7. **Setup .env file** - With domain, port, and credentials
8. **Install dependencies** - Run `bun install` as site user
9. **Build project** - Run `bun run build` as site user
10. **Create systemd service** - Generates and installs service file
11. **Reload systemd daemon** - `systemctl daemon-reload`
12. **Update Caddyfile** - Add reverse proxy block
13. **Reload Caddy** - `systemctl reload caddy` with --force flag
14. **Start service** - `systemctl start site@[domain-slug].service`
15. **Wait for startup** - Retry logic with delay
16. **Verify service** - Check `systemctl is-active`
17. **Update registry** - Record port allocation and credentials
18. **Return result** - Success response with all details

## Key Design Decisions

### Security Through Isolation

- **Per-site system users**: Each domain gets a dedicated unprivileged user (`site-example-com`)
- **systemd sandboxing**: Services run with strict file system restrictions
- **Path validation**: All file operations checked against workspace boundaries
- **Root fallback**: Bridge runs as root to manage infrastructure, drops privileges for site operations

### Port Management

- **Static range**: 3333-3999 (fixed allocation)
- **Registry file**: `/var/lib/claude-bridge/domain-passwords.json` tracks assignments
- **Availability check**: Verifies port not already listening before allocation
- **Collision detection**: Prevents two deployments from using same port

### DNS Validation

- **A record check**: Uses `dns.resolvev4()` to query authoritative nameservers
- **Cloudflare detection**: Recognizes Cloudflare IP ranges and skips validation (allows proxied domains)
- **Error clarity**: Distinguishes between DNS misconfiguration and connectivity issues

### Caddy Configuration

- **Dynamic blocks**: Generates Caddyfile entries with headers and reverse proxy
- **Atomic updates**: Reads entire file, modifies, writes atomically
- **Reload with --force**: Ensures configuration takes effect immediately
- **Domain-specific files**: Optional per-site Caddyfile entries if needed

## Error Handling

All errors throw `DeploymentError` with descriptive messages:

```typescript
throw new DeploymentError(`DNS validation failed: ${domain} does not resolve`)
throw new DeploymentError(`Failed to allocate port from registry`)
throw new DeploymentError(`systemctl start failed`)
```

Deployment is all-or-nothing: if any step fails, throw immediately and stop.

## Testing Strategy

Tests are organized by module and use **isolated temporary directories**:

- `tests/dns.test.ts` - Cloudflare IP detection, domain slugs
- `tests/ports.test.ts` - Port availability checking
- `tests/users.test.ts` - Domain to username conversion
- `tests/caddy.test.ts` - Caddyfile block generation
- `tests/files.test.ts` - Directory operations with temp dirs

**Zero system state modification** - tests use `mkdtemp()` and cleanup automatically.

## Extending the Library

### Adding a New Deployment Step

1. Create module in appropriate directory (e.g., `src/monitoring/health-check.ts`)
2. Export clear function signature
3. Add to `orchestration/deploy.ts` in correct sequence
4. Add unit test in `tests/`
5. Update this documentation

### Modifying Orchestration Order

Edit `orchestration/deploy.ts` - steps must follow this order:
1. Validation (before system changes)
2. Checks (DNS, ports, users)
3. Creation (dirs, services)
4. Configuration (Caddyfile, systemd)
5. Startup (start service, verify)
6. Registry update (record success)

### Adding New Configuration Options

1. Update `orchestration/types.ts` interface
2. Add validation in deployment function
3. Pass through to relevant modules
4. Document in README
5. Add test covering new option

## Dependencies

- `node:child_process` - spawnSync for shell commands
- `node:dns` - resolvev4 for DNS validation
- `node:fs` - file operations
- `node:net` - port availability checking
- `node:path` - path resolution and validation

No external npm dependencies - this is intentional for security and simplicity.

## Performance Characteristics

- **DNS validation**: 1-2 seconds (network dependent)
- **Port allocation**: Instant (file I/O)
- **User creation**: < 1 second
- **Directory setup**: 1-2 seconds (file copy size dependent)
- **Dependencies install**: Varies (5-30 seconds for typical site)
- **Service startup**: 1-5 seconds (application startup time dependent)
- **Total deployment**: Typically 30-60 seconds

## Critical Paths

These MUST NOT be modified without security review:

- Path validation in file operations - prevents directory traversal
- User privilege dropping - maintains isolation
- systemd service configuration - affects security boundaries
- Caddyfile generation - exposes sites to internet
- Registry updates - prevents port conflicts

See `../CLAUDE.md` for workspace isolation guidelines.
