# @webalive/shared

Shared constants and types used across all packages in the WebAlive monorepo.

## Purpose

This package serves as the single source of truth for:
- Cookie names and session configuration
- Environment variable names
- Shared type definitions
- Common constants

## Usage

```typescript
import { COOKIE_NAMES, ENV_VARS, SESSION_MAX_AGE } from "@webalive/shared"

// Cookie names
const sessionCookie = COOKIE_NAMES.SESSION // "auth_session"
const managerCookie = COOKIE_NAMES.MANAGER_SESSION // "manager_session"

// Environment variables
const envVar = ENV_VARS.BRIDGE_SESSION_COOKIE // "BRIDGE_SESSION_COOKIE"

// Session config
const maxAge = SESSION_MAX_AGE // 2592000 (30 days in seconds)
```

## Packages Using This

- `apps/web` - Main Next.js application
- `packages/tools` - MCP tools package
- Any future packages that need shared constants

## Development

```bash
# Build
bun run build

# Type check
bun run type-check

# Watch mode
bun run dev
```

## Adding New Constants

When adding new shared constants:

1. Add to appropriate file in `src/`
2. Export from `src/index.ts`
3. Update this README with examples
4. Ensure both apps/web and packages/tools can use it

## Why This Package Exists

Previously, cookie names and other constants were duplicated across packages, leading to:
- **Bug**: MCP tools sent `Cookie: session=JWT` but API expected `Cookie: auth_session=JWT`
- Hardcoded values in multiple places
- Risk of values getting out of sync

This package eliminates duplication and provides a single source of truth.
