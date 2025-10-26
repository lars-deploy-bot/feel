# Site Deployment Guide

This guide explains how to deploy a new website to the webalive server with full security isolation.

**🔒 SECURE DEPLOYMENT ONLY**

All new sites MUST be deployed using the secure systemd method:

```bash
/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh your-domain.com
```

**Security Features:**
- ✅ Process isolation (runs as dedicated user, not root)
- ✅ File system restrictions (cannot access other sites)
- ✅ Resource limits and security hardening
- ✅ systemd sandboxing with ProtectSystem=strict
- ✅ Memory and CPU quotas enforced
- ✅ Capability restrictions (no kernel access)

## 📋 What the Secure Deployment Does

## Prerequisites

- A domain with A record pointing to the server
- Site directory already exists in `/root/webalive/sites/your-domain.com/`
- Built React/Vite project in the `user/` subdirectory

## Deployment Steps

The secure deployment script automatically handles:

1. **DNS Validation**: Verifies domain points to correct server
2. **User Creation**: Creates dedicated system user for isolation
3. **Directory Setup**: Copies template or existing site files
4. **Ownership Fix**: Ensures site user owns all files
5. **systemd Service**: Creates and starts isolated service
6. **Port Assignment**: Finds available port automatically
7. **Caddy Update**: Adds domain to reverse proxy
8. **SSL Certificate**: Automatic HTTPS via Let's Encrypt

**No manual configuration required!**

## Automated Deployment

### Option 1: Web Interface (Recommended)
Visit the deployment web interface for the easiest experience:
```
https://terminal.goalive.nl/deploy
```

### Option 2: Command Line Scripts
For faster deployments:

```bash
# Deploy site (creates from template + systemd isolation)
/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh your-domain.com
```

### Option 3: API
For programmatic deployment:
```bash
curl -X POST https://terminal.goalive.nl/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"domain": "your-domain.com"}'
```

See `/root/webalive/claude-bridge/apps/web/app/api/deploy/route.ts` for API details.

**✅ Security Note:** All deployment methods now use secure systemd isolation by default.

## Example: Secure Deployment Process

For any new domain (e.g., `newsite.com`):

1. **Single Command**:
   ```bash
   /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh newsite.com
   ```

2. **Automatic Results**:
   - systemd service: `site@newsite-com.service`
   - Isolated user: `site-newsite-com`
   - Secure directory: `/srv/webalive/sites/newsite.com`
   - Auto port assignment (e.g., 3339)
   - Caddy reverse proxy configured
   - HTTPS certificate provisioned

## Troubleshooting

### Host Not Allowed Error
If you see "This host is not allowed", ensure your domain is in the `allowedHosts` array in `vite.config.ts`.

### Port Already in Use
Check which process is using the port:
```bash
lsof -i :PORT
```

Use a different port and update both Caddyfile and vite.config.ts accordingly.

### systemd Service Not Starting
Check service status and logs:
```bash
systemctl status site@your-domain-slug.service
journalctl -u site@your-domain-slug.service -f
```

Service automatically restarts on failure.

## File Structure

```
/srv/webalive/sites/your-domain.com/    # Secure isolated location
├── user/
│   ├── dist/           # Built files (auto-generated)
│   ├── src/            # Source code
│   ├── vite.config.ts  # Vite configuration
│   └── package.json    # Dependencies
└── DEPLOYMENT.md       # This guide

# Service Management
systemctl status site@your-domain-slug.service
systemctl restart site@your-domain-slug.service
journalctl -u site@your-domain-slug.service -f
```