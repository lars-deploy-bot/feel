# Claude Bridge Systemd Services

Service files for running claude-bridge environments.

## Installation

```bash
# Copy to systemd
sudo cp ops/systemd/*.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable claude-bridge-production
sudo systemctl enable claude-bridge-staging
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

| Environment | Port |
|-------------|------|
| Production  | 9000 |
| Staging     | 8998 |
| Dev         | 8997 |

## Notes

- Production/staging run from `.builds/{env}/current/standalone`
- Dev runs directly from source with `bun run dev`
- All services use EnvironmentFile for secrets (not committed to git)
