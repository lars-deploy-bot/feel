# Claude Bridge Deployment Environments

## Production

**Domain:** `terminal.goalive.nl`
**Port:** `8999`
**Process:** `claude-bridge`
**Mode:** Standalone Next.js server

**Deploy:**
```bash
bun run deploy
```

Executes `scripts/build-and-serve.sh`: pulls git → installs → atomic build to `.builds/` → stops old PM2 → starts standalone server → reloads Caddy

**Monitor:**
```bash
bun run see           # logs
pm2 list              # status
pm2 restart claude-bridge
```

## Staging

**Domain:** `staging.terminal.goalive.nl`
**Port:** `8998`
**Process:** `claude-bridge-staging`
**Mode:** Dev server with hot reload

**Deploy:**
```bash
bun run staging
```

**Monitor:**
```bash
bun run see:staging
pm2 list
pm2 restart claude-bridge-staging
```

## Network

```
Internet → Caddy (80/443)
  ↓
terminal.goalive.nl → localhost:8999
staging.terminal.goalive.nl → localhost:8998
```

## Caddy Config

**Location:** `/root/webalive/claude-bridge/Caddyfile`

```caddy
terminal.goalive.nl {
    reverse_proxy localhost:8999
}

staging.terminal.goalive.nl {
    reverse_proxy localhost:8998
}
```

Reload: `systemctl reload caddy`

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-xxx
BRIDGE_PASSCODE=your_secure_passcode
CLAUDE_MODEL=claude-haiku-4-5        # Optional
WORKSPACE_BASE=/srv/webalive/sites            # Optional
```

**Local dev only:**
```bash
BRIDGE_ENV=local
LOCAL_TEMPLATE_PATH=/path/to/packages/template/user
```

## Atomic Build

Builds isolated in `.builds/v{n}/`, old version remains running until new build succeeds. See `docs/deployment/deployment.md`.

## Quick Verification

After deployment:

- [ ] Site responds: `curl -H "Host: terminal.goalive.nl" localhost:8999`
- [ ] PM2 shows running: `pm2 list | grep claude-bridge`
- [ ] Logs clean: `bun run see | grep -i error` (no errors)
- [ ] Caddy active: `systemctl status caddy`
- [ ] Public domain works: `curl https://terminal.goalive.nl`

## Troubleshooting

**Port already in use:**
- `lsof -i :8999` - find process
- `pm2 kill` - stop all PM2 processes
- `pm2 list` - verify clean

**Build fails atomically:**
- Old version still running (safe)
- Check `.builds/` directory has space
- Check git pull succeeded: `cd /root/webalive/claude-bridge && git status`

**Caddy not reloading:**
- Check syntax: `caddy validate --config /root/webalive/claude-bridge/Caddyfile`
- Manual reload: `systemctl reload caddy`
- View logs: `journalctl -u caddy -n 50`
