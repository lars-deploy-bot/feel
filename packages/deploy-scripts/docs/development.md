# Development Guide

## Local Development

### Setup

```bash
cd /root/webalive/claude-bridge
bun install
```

### Building

```bash
bun run build -F @alive-brug/deploy-scripts
```

Or build entire workspace:
```bash
bun run build
```

### Testing

```bash
cd packages/deploy-scripts
bun test
```

Run specific test file:
```bash
bun test tests/dns.test.ts
```

Watch mode:
```bash
bun test --watch
```

## Code Organization Rules

### Module Boundaries

Each module in `src/` is **independent and testable**:

```
dns/        - Network operations only, zero system changes
ports/      - File I/O only, no spawning commands
users/      - spawnSync only, no file I/O
files/      - File operations only, no user creation
caddy/      - File operations only, no reload commands
systemd/    - spawnSync only, no file operations
```

**CRITICAL**: Do NOT add dependencies between modules. The orchestration layer ties them together.

### Import Rules

```typescript
// ✓ CORRECT - import from sibling modules
import { isCloudflareIP } from "../dns/validation"

// ✗ WRONG - circular dependency
// src/dns/validation.ts should NOT import from src/users/

// ✓ CORRECT - import type for types
import type { DeploymentConfig } from "./types"

// ✗ WRONG - using `import` instead of `import type` for interfaces
import { DeploymentConfig } from "./types"
```

### Adding New Utilities

If two modules need same function:

```typescript
// ✓ CORRECT - add to orchestration/utils.ts
export async function isPortListening(port: number): Promise<boolean> { ... }

// Then import in both modules
import { isPortListening } from "../orchestration/utils"

// ✗ WRONG - duplicate function in both modules
// ✗ WRONG - create new module just for one util
```

## Making Changes

### Small Fix (bug, typo)

1. Edit file
2. Run `bun test` to verify
3. No documentation update needed if internal only

### New Feature (DNS check improvement, better error message)

1. Edit relevant module
2. Add test in corresponding test file
3. Update README if user-facing
4. Update architecture.md if changes flow

### New Deployment Step (add monitoring, add backup, etc.)

1. Create new module in appropriate directory
2. Export clear function with JSDoc comments
3. Add to `orchestration/deploy.ts` in correct sequence
4. Add comprehensive tests
5. Update README and architecture.md
6. Document why this step must run at this point

## Testing Requirements

### Unit Tests

- ✓ Test happy path
- ✓ Test error cases
- ✓ Test edge cases (empty strings, special characters, boundaries)
- ✓ Use isolated temp directories for file operations

### No System State Tests

- ✗ Never create actual system users during tests
- ✗ Never create actual files outside `/tmp`
- ✗ Never call `systemctl` during tests
- ✗ Never make actual DNS queries

### Test File Cleanup

Use `mkdtemp()` with cleanup:

```typescript
import { mkdtemp, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const tempDir = mkdtemp(join(tmpdir(), "test-"))
try {
  // Test code
} finally {
  rmSync(tempDir, { recursive: true })
}
```

## Code Style

### TypeScript Strict Mode

```typescript
// ✓ CORRECT
const value: string = "hello"
async function deploy(config: DeploymentConfig): Promise<DeploymentResult> { ... }

// ✗ WRONG
const value = "hello"  // implicit any-like
function deploy(config) { ... }  // missing types
```

### Error Messages

```typescript
// ✓ CORRECT - specific, actionable
throw new DeploymentError(`DNS validation failed: ${domain} does not resolve to ${serverIP}`)
throw new DeploymentError(`Port ${port} already in use, next available: ${nextPort}`)

// ✗ WRONG - vague
throw new DeploymentError("Error occurred")
throw new DeploymentError("Failed")
```

### Comments

```typescript
// ✓ CORRECT - explain WHY, not WHAT
// Cloudflare proxies DNS so we skip validation for their IPs
if (isCloudflareIP(ip)) return true

// ✗ WRONG - obvious from code
// Check if IP is Cloudflare
if (isCloudflareIP(ip)) { ... }
```

## Before Committing

```bash
# Format code
bun run format -F @alive-brug/deploy-scripts

# Lint
bun run lint -F @alive-brug/deploy-scripts

# Test
bun test

# Build
bun run build -F @alive-brug/deploy-scripts

# All checks pass? Commit
```

## Debugging Tips

### Check what deploySite actually does

```typescript
import { deploySite } from "@alive-brug/deploy-scripts"

const result = await deploySite({
  domain: "test.example.com",
  email: "test@example.com"
})

console.log(result)
```

### Check specific module

```typescript
import { isCloudflareIP } from "./src/dns/validation"

console.log(isCloudflareIP("1.1.1.1"))  // true
console.log(isCloudflareIP("8.8.8.8"))  // false
```

### Verify port allocation

```typescript
import { getOrAssignPort } from "./src/ports/registry"

const port = await getOrAssignPort("test.com")
console.log(port)  // 3333, 3334, etc.
```

## Common Pitfalls

### Pitfall 1: Assuming template exists

```typescript
// ✗ WRONG - will crash if template missing
const files = readdirSync(templatePath)

// ✓ CORRECT
if (!existsSync(templatePath)) {
  throw new DeploymentError(`Template not found at ${templatePath}`)
}
```

### Pitfall 2: Not cleaning up temp files

```typescript
// ✗ WRONG - temp files leak
const tempDir = mkdtempSync(...)
// ... code that might throw ...

// ✓ CORRECT - always cleanup
const tempDir = mkdtempSync(...)
try {
  // ... code ...
} finally {
  rmSync(tempDir, { recursive: true })
}
```

### Pitfall 3: Concurrent deployments

```typescript
// ✗ WRONG - race condition on port allocation
await deploySite({ domain: "a.com" })
await deploySite({ domain: "b.com" })

// ✓ CORRECT - sequential
const result1 = await deploySite({ domain: "a.com" })
const result2 = await deploySite({ domain: "b.com" })
```

### Pitfall 4: Trusting user input

```typescript
// ✗ WRONG - domain could have path traversal chars
const path = `/srv/webalive/sites/${domain}/`

// ✓ CORRECT - always validate
if (!isValidDomain(domain)) {
  throw new DeploymentError(`Invalid domain: ${domain}`)
}
```

## Need Help?

- Read the module you're working on - code should be self-documenting
- Check existing tests for usage patterns
- Review architecture.md for design rationale
- See parent CLAUDE.md for workspace guidelines
