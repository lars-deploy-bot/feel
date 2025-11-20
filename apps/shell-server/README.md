# Shell Server

WebSocket-based terminal server for shell.terminal.goalive.nl

## Overview

This server provides a browser-based terminal interface with:
- WebSocket-based PTY (pseudo-terminal) sessions
- Password authentication
- Rate limiting for security
- Workspace isolation support

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3500, production: 3888)
- `SHELL_PASSWORD` - Required authentication password
- `NODE_ENV` - Environment (production/development)

### Production Deployment

The shell-server runs as a **systemd service** (not PM2) for:
- ✅ Automatic restarts on failure
- ✅ Boot-time auto-start
- ✅ Resource limits (500MB memory, 100 tasks)
- ✅ Built-in logging via journalctl
- ✅ Simple management

#### Service Management

```bash
# Start the service
systemctl start shell-server

# Stop the service
systemctl stop shell-server

# Restart the service
systemctl restart shell-server

# Check status
systemctl status shell-server

# View logs (live)
journalctl -u shell-server -f

# View recent logs
journalctl -u shell-server -n 100
```

#### Automatic Rebuilds

**Shell-server is automatically rebuilt and restarted** when you deploy staging or dev:

```bash
# Deploy staging (automatically rebuilds shell-server)
make staging

# Deploy dev (automatically rebuilds shell-server)
make dev
```

Both deployment commands will:
1. Build the main web app
2. **Also rebuild shell-server**
3. **Restart the systemd service**
4. Verify it's running

#### Manual Rebuild (if needed)

```bash
cd /root/webalive/claude-bridge/apps/shell-server

# Build
bun run build

# Restart service
systemctl restart shell-server

# Verify
systemctl status shell-server
curl -I http://localhost:3888
```

#### Service Configuration

- **Systemd unit**: `/etc/systemd/system/shell-server.service`
- **Environment file**: `apps/shell-server/.env.production` (NOT in git)
- **Auto-restart**: Always, with 5s delay, max 5 attempts per minute

## Routes

- `GET /` - Terminal UI (HTML page)
- `WebSocket /ws` - Terminal WebSocket connection

## Security

- Password authentication required via `auth` query parameter
- Rate limiting: 5 failed attempts = 15 minute lockout
- Rate limit state persisted to `.rate-limit-state.json`

## Domains

- Production: `shell.terminal.goalive.nl` → port 3888
- Alternative: `sk.goalive.nl` → port 3888

## Troubleshooting

### Service won't start

1. Check logs: `journalctl -u shell-server -n 50`
2. Verify build exists: `ls -la dist/index.js`
3. Check environment variables in service file: `/etc/systemd/system/shell-server.service`
4. Rebuild if needed: `bun run build`

### Port already in use

```bash
# Find what's using port 3888
lsof -i :3888

# Stop the systemd service
systemctl stop shell-server
```

### WebSocket connection fails

- Verify Caddy configuration: `/root/webalive/claude-bridge/Caddyfile`
- Check firewall: `ufw status`
- Test local connection: `curl -I http://localhost:3888`

## Development

```bash
# Install dependencies
bun install

# Run in watch mode
bun run dev

# Build for production
bun run build

# Type check
bun run type-check
```

## Architecture

- **Framework**: Hono.js (lightweight web framework)
- **WebSocket**: `@hono/node-ws` adapter
- **PTY**: `node-pty` for terminal emulation
- **Runtime**: Node.js (built with Bun)
- **Process Manager**: systemd
