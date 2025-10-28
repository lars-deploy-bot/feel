# Local Development Setup

This guide explains how to set up Claude Bridge for local development.

## Overview

When running Claude Bridge locally, you'll use a **test workspace** that stays on your machine only and never gets committed to git. This allows you to safely experiment with Claude without affecting production workspaces.

## Architecture

### Local Development Mode

```
BRIDGE_ENV=local
├── Test User: workspace="test", passcode="test"
├── Workspace: .alive/template (local-only, gitignored)
└── Template Source: packages/template/user
```

### Directory Structure

```
alive-brug/
├── .alive/                      # Local-only workspace (gitignored)
│   └── template/                # Your test workspace
├── packages/
│   └── template/
│       └── user/                # Seed template (committed to git)
└── apps/
    └── web/
        └── .env.local           # Local environment config
```

## Quick Start

### 1. Run Setup Script

From the monorepo root:

```bash
bun run setup
```

This will:
- Create the `.alive` directory (if it doesn't exist)
- Copy `packages/template/user` to `.alive/template` (if it doesn't exist)
- Set up your local development workspace

### 2. Configure Environment

Create or update `apps/web/.env.local`:

```bash
BRIDGE_ENV=local
LOCAL_TEMPLATE_PATH=/absolute/path/to/alive-brug/.alive/template
```

**Note**: Replace `/absolute/path/to/alive-brug` with your actual monorepo root path.

The setup script will output the exact path you need to use.

### 3. Start Development Server

From the monorepo root:

```bash
bun run web
```

Or from `apps/web`:

```bash
bun run dev
```

### 4. Login with Test Credentials

Navigate to `http://localhost:8999` and log in:

- **Workspace**: `test`
- **Passcode**: `test`

## How It Works

### Test User (Local Only)

When `BRIDGE_ENV=local`, the login endpoint (`apps/web/app/api/login/route.ts`) accepts:

```typescript
workspace: "test"
passcode: "test"
```

This bypasses domain password validation and sets a session cookie with value `test-user`.

### Workspace Resolution

The workspace resolver (`apps/web/app/features/claude/workspaceRetriever.ts`) checks:

1. **If `BRIDGE_ENV=local`**: Use `LOCAL_TEMPLATE_PATH` environment variable
2. **If `terminal.*` hostname**: Use custom workspace from request body
3. **Otherwise**: Use domain-based workspace (production mode)

### Security

- **Test user only works when `BRIDGE_ENV=local`** – production deploys won't have this flag
- **`.alive/` is gitignored** – your local workspace never gets committed
- **`LOCAL_TEMPLATE_PATH` must be absolute** – no monorepo path resolution issues

## Workspace Management

### Resetting Your Local Workspace

To start fresh:

```bash
rm -rf .alive/template
bun run setup
```

This will recreate the template from `packages/template/user`.

### Modifying the Seed Template

If you want to change what new local workspaces start with:

1. Edit files in `packages/template/user/`
2. Commit changes to git
3. Delete and recreate your local workspace:
   ```bash
   rm -rf .alive/template
   bun run setup
   ```

## Troubleshooting

### Error: "LOCAL_TEMPLATE_PATH environment variable required"

**Cause**: `BRIDGE_ENV=local` is set but `LOCAL_TEMPLATE_PATH` is missing.

**Fix**: Run `bun run setup` and add the displayed `LOCAL_TEMPLATE_PATH` to `apps/web/.env.local`.

### Error: "Local template workspace does not exist"

**Cause**: The path in `LOCAL_TEMPLATE_PATH` doesn't exist.

**Fix**: Run `bun run setup` to create the workspace.

### Error: "LOCAL_TEMPLATE_PATH must be an absolute path"

**Cause**: The path is relative (e.g., `../../.alive/template`) instead of absolute.

**Fix**: Use the full absolute path shown by `bun run setup` (e.g., `/Users/you/alive-brug/.alive/template`).

### Error: "LOCAL_TEMPLATE_PATH exists but is not a directory"

**Cause**: A file exists at the path instead of a directory.

**Fix**: Remove the file and run `bun run setup --force`.

### Changes not appearing

Make sure:
1. `BRIDGE_ENV=local` is set in `.env.local`
2. `LOCAL_TEMPLATE_PATH` points to the correct absolute path
3. You're logged in with workspace `test` and passcode `test`
4. You've restarted the dev server after changing `.env.local`

### Setup script edge cases

**Force reset workspace**:
```bash
bun run setup --force
```

**Empty template directory**:
The script auto-detects and repopulates empty template directories.

**Permission errors**:
Ensure you have read/write access to the monorepo directory.

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `BRIDGE_ENV` | Yes | Enable local development mode | `local` |
| `LOCAL_TEMPLATE_PATH` | Yes | Absolute path to local workspace | `/Users/you/alive-brug/.alive/template` |
| `ANTHROPIC_API_KEY` | Yes | Claude API key | `sk-ant-...` |
| `BRIDGE_PASSCODE` | No | Bridge passcode (any works if unset) | `your-password` |

## Production vs Development

| Aspect | Production | Local Development |
|--------|-----------|-------------------|
| Environment | `BRIDGE_ENV` not set | `BRIDGE_ENV=local` |
| Login | Domain passwords | `test`/`test` |
| Workspace | `/srv/webalive/sites/{domain}/user` | `.alive/template` |
| Git tracking | Workspaces not in repo | `.alive/` gitignored |
