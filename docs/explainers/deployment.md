# Deployment

## PM2 Management

Deploy the application using PM2:

```bash
./scripts/start-pm2.sh
```

This script:
- Removes all existing `claude-bridge` PM2 processes
- Kills any remaining Next.js processes and cleans lock files
- Installs dependencies with `bun i`
- Starts a single PM2 process running on port 8999

## Port Configuration

- **External**: `terminal.goalive.nl` (Caddy proxy on port 9999)
- **Internal**: Next.js app runs on port 8999
- **Caddy**: Proxies `terminal.goalive.nl` → `localhost:8999`

## Troubleshooting

If the app fails to start:
1. Check for port conflicts: `lsof -ti:8999`
2. Verify Caddy config: `/etc/caddy/Caddyfile`
3. Check PM2 logs: `pm2 logs claude-bridge`
4. Restart with cleanup: `./scripts/start-pm2.sh`