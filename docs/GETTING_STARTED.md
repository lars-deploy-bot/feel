# Getting Started

Quick setup guide for Claude Bridge local development.

## Prerequisites

- **Bun** 1.2.22+ (runtime & package manager)
- **Anthropic API Key** (get from console.anthropic.com)
- **Node.js** (for compatibility, though we use Bun)

## Quick Start

### 1. Clone & Install

```bash
git clone <repository>
cd claude-bridge
bun install
```

### 2. Run Setup Script

```bash
bun run setup
```

This creates:
- `.alive/template/` - Your local test workspace (gitignored)
- Configuration instructions for `.env.local`

### 3. Configure Environment

Create `apps/web/.env.local`:

```bash
# Required
BRIDGE_ENV=local
LOCAL_TEMPLATE_PATH=/absolute/path/to/claude-bridge/.alive/template
ANTHROPIC_API_KEY=sk-ant-...

# Optional
BRIDGE_PASSCODE=your-password  # If unset, any passcode works in local mode
```

**Note**: Use the absolute path shown by the setup script.

### 4. Start Development Server

```bash
bun run dev
```

Server starts at `http://localhost:8999`

### 5. Login with Test Credentials

- **Workspace**: `test`
- **Passcode**: `test`

## Local Development Architecture

```
Local Mode (BRIDGE_ENV=local)
├── Test workspace: .alive/template (gitignored)
├── Seed template: packages/template/user (committed)
├── Test credentials: workspace="test", passcode="test"
└── Bypasses domain password validation
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `BRIDGE_ENV` | Yes | Enable local dev mode | `local` |
| `LOCAL_TEMPLATE_PATH` | Yes | Absolute path to workspace | `/Users/you/claude-bridge/.alive/template` |
| `ANTHROPIC_API_KEY` | Yes | Claude API key | `sk-ant-...` |
| `BRIDGE_PASSCODE` | No | Bridge passcode (any works if unset) | `your-password` |

## Common Commands

```bash
bun run dev           # Start dev server (port 8999)
bun run build         # Build for production
bun test              # Run unit tests
bun run test:e2e      # Run E2E tests (requires chromium: bunx playwright install chromium)
bun run format        # Format code (Biome)
bun run lint          # Lint code (Biome)
```

## Resetting Your Workspace

Start fresh:

```bash
rm -rf .alive/template
bun run setup
```

## Troubleshooting

### Error: "LOCAL_TEMPLATE_PATH environment variable required"

**Fix**: Run `bun run setup` and add the path to `.env.local`

### Error: "Local template workspace does not exist"

**Fix**: Run `bun run setup` to create the workspace

### Error: "LOCAL_TEMPLATE_PATH must be an absolute path"

**Fix**: Use the full absolute path (e.g., `/Users/you/claude-bridge/.alive/template`), not relative paths

### Changes not appearing

Ensure:
1. `BRIDGE_ENV=local` in `.env.local`
2. `LOCAL_TEMPLATE_PATH` is correct
3. Logged in with `test`/`test`
4. Restarted dev server after changing `.env.local`

## Next Steps

- [Architecture Overview](./architecture/README.md) - Understand system design
- [Security Guide](./security/README.md) - Security patterns and enforcement
- [Testing Guide](./testing/README.md) - Write tests for your changes
- [Features](./features/README.md) - Explore available features
