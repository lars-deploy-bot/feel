# TODO: Re-enable Preview Subdomain Authentication

**Date:** 2025-12-06
**Status:** Open
**Priority:** Medium

## What Changed

Disabled `forward_auth` for all `*.preview.terminal.goalive.nl` subdomains in `ops/caddy/Caddyfile`.

## Why

The `forward_auth` was hardcoded to `localhost:8998` (staging). When logged into `dev.terminal.goalive.nl` (port 8997), auth failed because sessions aren't shared across environments.

## Current State

- All preview subdomains are now publicly accessible (no auth required)
- Less secure but allows dev/staging/prod terminals to all view previews

## Proper Fix Options

1. **Shared Redis sessions** - Sessions work across all environments (recommended)
2. **Dynamic port selection** - forward_auth checks multiple ports based on request origin
3. **Environment-aware Caddyfile** - Different configs per environment

## Files Modified

- `ops/caddy/Caddyfile` - Removed 84 `forward_auth` blocks from preview subdomains

## To Restore

```bash
git checkout ops/caddy/Caddyfile
systemctl reload caddy
```
