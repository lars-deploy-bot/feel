# Environment Configuration

**Single source of truth: `environments.json`**

All environment definitions (ports, process names, domains, etc.) are defined in ONE place. Other files read from it.

## File Architecture (DRY)

| File | Purpose | Reads From |
|------|---------|-----------|
| **`environments.json`** | **SINGLE SOURCE OF TRUTH** - All env data | N/A |
| `environments.config.ts` | TypeScript config (typed) | environments.json |
| `bridge.config.js` | Legacy wrapper (backward compatible) | environments.json |
| `scripts/env-helper.sh` | Bash helper for shell scripts | environments.json |

### One file, three interfaces
- **JSON**: Raw configuration (simple, universal)
- **TypeScript**: Type-safe with validation and helper functions
- **Bash**: Environment variables via shell sourcing
- **CommonJS**: Backward-compatible Node.js API

All three read from `environments.json` = **True DRY principle**

## Adding a New Environment

**Only ONE place to update: `environments.json`**

### 1. Edit `environments.json`

```json
{
  "environments": {
    "production": { ... },
    "dev": { ... },
    "staging": {
      "key": "staging",
      "displayName": "Staging",
      "prefix": "staging",
      "port": 8997,
      "domain": "your-staging-domain.goalive.nl",
      "processName": "claude-bridge-staging",
      "serverScript": "node_modules/.bin/next",
      "workspacePath": "/srv/webalive/sites",
      "isProduction": false,
      "hasHotReload": true,
      "deployCommand": "make staging",
      "logsCommand": "make logs-staging",
      "restartCommand": "pm2 restart claude-bridge-staging"
    }
  }
}
```

### 2. Update TypeScript type (optional)

If using TypeScript, update the `EnvironmentKey` type in `environments.config.ts`:

```typescript
export type EnvironmentKey = 'production' | 'dev' | 'staging'
```

That's it! All other files (`bridge.config.js`, `env-helper.sh`, etc.) will automatically read the new environment.

## Using the Configuration

### TypeScript/JavaScript

```typescript
import { environments, getEnvironment, getEnvironmentByPort } from './environments.config'

// Get by key
const devEnv = environments.dev
console.log(devEnv.port)        // 8998
console.log(devEnv.processName) // claude-bridge-dev

// Helper functions
const env = getEnvironment('production')
const byPort = getEnvironmentByPort(8999)
const byProcess = getEnvironmentByProcessName('claude-bridge')
```

### Bash Scripts

```bash
#!/bin/bash
source "$(dirname "$0")/env-helper.sh"

# Access variables
echo "Dev port: $ENV_DEV_PORT"
echo "Prod process: $ENV_PROD_PROCESS_NAME"

# Use in commands
pm2 logs "$ENV_DEV_PROCESS_NAME" --lines 1000
```

### Node.js (CommonJS)

```javascript
const config = require('./bridge.config.js')
console.log(config.ports.dev)     // 8998
console.log(config.appName.prod)  // claude-bridge
```

## Validation

Both configs include validation to prevent:
- Duplicate ports
- Duplicate process names
- Invalid port ranges (1024-65535)
- Missing production environment

## When to Update

Update these files when:
- Adding a new environment
- Changing a port
- Renaming a process
- Changing a domain
- Adding environment-specific properties

**Do NOT hardcode** port numbers, process names, or domains elsewhere. Always reference the config.

## Migration Guide: Staging → Dev Rename

Example of how the "staging" environment was renamed to "dev":

**Before:**
```
environments.config.ts:
  staging: { port: 8998, processName: 'claude-bridge-staging', ... }

bridge.config.js:
  ports.staging: 8998
  appName.staging: 'claude-bridge-staging'

scripts/*.sh:
  pm2 logs claude-bridge-staging
  pm2 restart claude-bridge-staging
```

**After:**
```
environments.config.ts:
  dev: { port: 8998, processName: 'claude-bridge-dev', ... }

bridge.config.js:
  ports.dev: 8998
  appName.dev: 'claude-bridge-dev'

scripts/*.sh:
  source env-helper.sh
  pm2 logs "$ENV_DEV_PROCESS_NAME"
```

## Benefits

1. **Single source of truth** - Change once, propagates everywhere
2. **Type-safe** - TypeScript catches errors at compile time
3. **Validated** - Prevents duplicate ports/names
4. **Documented** - All properties in one place
5. **Queryable** - Helper functions to find envs by port, name, domain
6. **Bash-friendly** - Works in shell scripts via env-helper.sh
7. **Backward compatible** - Legacy code still works with bridge.config.js
