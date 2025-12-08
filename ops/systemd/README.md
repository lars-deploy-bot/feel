# Claude Bridge Systemd Services

Service files for running claude-bridge environments and infrastructure.

## Installation

```bash
# Copy to systemd
sudo cp ops/systemd/*.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable claude-bridge-production
sudo systemctl enable claude-bridge-staging
sudo systemctl enable caddy-shell
```

## Usage

```bash
# Start/stop/restart
sudo systemctl start claude-bridge-production
sudo systemctl stop claude-bridge-staging
sudo systemctl restart claude-bridge-dev

# View logs
journalctl -u claude-bridge-production -f
journalctl -u claude-bridge-staging -n 50
```

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Production | 9000 | Claude Bridge production |
| Staging | 8998 | Claude Bridge staging |
| Dev | 8997 | Claude Bridge dev |
| caddy-shell | 8443 | Isolated Caddy for shell SSE connections |

## Services

### Claude Bridge Services
- Production/staging run from `.builds/{env}/current/standalone`
- Dev runs directly from source with `bun run dev`
- All services use EnvironmentFile for secrets (not committed to git)

### caddy-shell.service
Isolated Caddy instance for Go shell domains (shell.terminal.goalive.nl, go.goalive.nl, sk.goalive.nl).
This instance is **never auto-reloaded** to preserve long-lived SSE connections.

See [CADDY_SHELL_ISOLATION.md](../docs/operations/CADDY_SHELL_ISOLATION.md) for full documentation.
