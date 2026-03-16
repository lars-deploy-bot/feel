# Cloudflare Tunnel Migration

Migrated all `*.alive.best` routing from nginx → Caddy → Go preview-proxy to Cloudflare Tunnel (`cloudflared`) with an internal Caddy proxy layer for image/file serving. Done 2026-03-16 on Server 1 (alive.best, 138.201.56.93).

## What was replaced

| Before | After |
|--------|-------|
| nginx (SNI routing, port 80/443) | **Deleted** |
| Caddy (TLS + reverse proxy, port 8444/8081, ~140 generated blocks) | Caddy with **two roles**: public :443 for custom domains, internal :8444 for image/file serving |
| caddy-shell (WebSocket isolation, port 8443) | **Deleted** — tunnel handles WebSocket natively |
| Go preview-proxy (JWT auth, port 5055) | **Kept** — handles `preview--*` auth + HTML script injection |
| port-map.json cron (every 5min) | **Deleted** |
| generate-routing.ts (561 lines) | **Not needed** — tunnel ingress IS the routing table |
| nginx SNI map generation | **Deleted** |

## Architecture

```text
*.alive.best site traffic (e.g. larry.alive.best):
  Browser → Cloudflare CDN → cloudflared → Caddy :8444 → localhost:{site_port}
                                            ↳ /_images/* served from /srv/webalive/storage
                                            ↳ /files/* served from site workspace

*.alive.best infrastructure (app, staging, dev, shell):
  Browser → Cloudflare CDN → cloudflared → localhost:{port} (direct, no Caddy)

Preview iframes (preview--{label}.alive.best):
  Browser → Cloudflare CDN → cloudflared → Caddy :8444 → preview-proxy :5055
                                                          ↳ JWT auth + session cookie
                                                          ↳ HTML nav script injection
                                                          ↳ /_images/* from storage
                                                          ↳ reverse proxy → localhost:{site_port}

Custom domains (scalotta.it, barendbootsma.com, etc.):
  Browser → Caddy :443 (Let's Encrypt TLS) → localhost:{site_port}
                                              ↳ /_images/* from /srv/webalive/storage
```

### Why preview broke and how it was fixed

Cloudflare Tunnel ingress does **not** support partial-wildcard hostname patterns like `preview--*.alive.best`. Only standard `*.domain.com` wildcards work. When the migration initially routed all `*.alive.best` subdomains directly to site ports, `preview--bookmedia-alive-best.alive.best` had no matching ingress rule and no fallback — it returned 404 from the tunnel's catch-all.

**Fix:** A `*.alive.best` wildcard ingress rule was added as the second-to-last rule (before the catch-all `http_status:404`). Specific hostname rules (e.g. `larry.alive.best`) take precedence because Cloudflare routes by specificity. The wildcard catches everything else, including `preview--*` subdomains, and routes them to Caddy internal (:8444), which maps `*.alive.best` to `preview-proxy` (:5055) via its `map` directive.

### Why `/_images/*` broke and how it was fixed

Previously, Caddy intercepted `/_images/*` requests with `handle_path` before they reached the site's Vite dev server. After the tunnel migration initially routed `cloudflared → localhost:{site_port}` directly, `/_images/*` requests hit the Vite dev server, which caught all routes and returned SPA HTML (200 with `text/html` — not an image).

**Fix:** An internal Caddy instance on `:8444` was added between cloudflared and the site ports. All tunnel site ingress rules were changed from `http://localhost:{site_port}` to `http://localhost:8444`. Caddy uses a `map {host} {site_upstream}` directive with all 124+ hostname→port mappings. `handle_path /_images/*` intercepts image requests and serves from `/srv/webalive/storage`. Everything else proxies to `{site_upstream}`.

Infrastructure routes (`app.alive.best`, `staging.alive.best`, `dev.alive.best`, `go.alive.best`) bypass internal Caddy and go directly to their ports — they don't need image serving.

## Special domains

### `dl1.alive.best` — E2E test domain

`dl1.alive.best` is a protected hostname used by deploy-live E2E tests (`apps/web/e2e-tests/deploy-live.spec.ts`). It has an **explicit** ingress rule in the tunnel — it must never be removed or left to implicit wildcard behavior. Before the tunnel migration, it existed as a Caddy block with `respond "prewarm" 200` for TLS cert prewarming. With Cloudflare Tunnel, TLS prewarming is unnecessary (Cloudflare handles certs), but the hostname must remain routable for E2E to deploy test sites to it.

### Custom domains (direct-IP, not Cloudflare-proxied)

These domains point at `138.201.56.93` via A record and are NOT behind Cloudflare. They are served by Caddy on public `:80/:443` with automatic Let's Encrypt certificates. They will remain on Caddy until their DNS is migrated behind Cloudflare (zone added, nameservers changed at registrar).

Current custom domains (14):
`barendbootsma.com`, `demo.goalive.nl`, `five.goalive.nl`, `kranazilie.nl`, `larsvandeneeden.com`, `riggedgpt.com`, `roefapp.nl`, `scalotta.it`, `six.goalive.nl`, `staging.terminal.goalive.nl`, `terminal.goalive.nl`, `three.goalive.nl`, `two.goalive.nl`, `wheelpickername.com`

## Setup steps (repeat for Server 2 / sonno.tech)

### 1. Install cloudflared

```bash
curl -L --output /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i /tmp/cloudflared.deb
```

### 2. Create tunnel via API

```bash
SECRET=$(openssl rand -base64 32)

curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"alive-server1\", \"tunnel_secret\": \"${SECRET}\"}"

# Save TunnelID, TunnelSecret, and token from response
```

**Server 1 values:**
- Tunnel ID: `055f6248-5434-487c-a074-f9fab9aa6fe1`
- Tunnel name: `alive-server1`
- Account ID: `12a356492b4fc7c94940ad21f8538343`
- Zone ID (alive.best): `5339831a111384cc0d8fa1b286897113`

### 3. Save credentials

```bash
mkdir -p /root/.cloudflared
cat > /root/.cloudflared/${TUNNEL_ID}.json << 'EOF'
{"AccountTag":"...","TunnelID":"...","TunnelName":"...","TunnelSecret":"..."}
EOF
```

### 4. Push initial config via API (enables remote management)

```bash
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"config": {"ingress": [{"hostname": "", "service": "http_status:404"}]}}'
```

### 5. Install as systemd service

```bash
cloudflared service install ${TUNNEL_TOKEN}
systemctl status cloudflared
```

### 6. Sync all site routes to tunnel

```bash
cd /root/webalive/alive

CF_ACCOUNT_ID="..." CF_TUNNEL_ID="..." CF_API_TOKEN="..." \
CF_ZONE_ID="..." CF_BASE_DOMAIN="alive.best" \
SERVER_CONFIG_PATH="/var/lib/alive/server-config.json" \
SUPABASE_URL="<from .env.production>" \
SUPABASE_SERVICE_ROLE_KEY="<from .env.production>" \
bun run --cwd packages/tunnel src/sync.ts
```

After sync, update all site ingress rules to point to `http://localhost:8444` (internal Caddy) instead of directly to site ports. Infrastructure routes (app, staging, dev, shell) stay direct.

### 7. Add wildcard + dl1 + service routes

The sync creates per-site routes but misses:

1. **`*.alive.best` wildcard** — must be second-to-last rule (before catch-all). Routes to `http://localhost:8444`. Catches `preview--*` subdomains and any unknown subdomains.
2. **`dl1.alive.best`** — explicit E2E test domain. Routes to `http://localhost:8444`.
3. **Infrastructure services** — `oc.alive.best` (→ :18789), `services.alive.best` (→ :1200).

Cloudflare Tunnel does **not** support `preview--*.alive.best` as a hostname pattern. Only `*.domain.com` is valid. The generic `*.alive.best` wildcard placed after all explicit rules is the correct solution.

### 8. Flip DNS

**For *.alive.best (Cloudflare zone):**

```bash
# Delete wildcard A record
curl -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}"

# Create wildcard CNAME → tunnel
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"CNAME\",\"name\":\"*.alive.best\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true,\"ttl\":1}"

# Delete A records that override the wildcard:
# - dev.alive.best (tunnel has ingress rule)
# - *.preview.alive.best (wildcard catches these)
```

**Keep these A records** (not tunnel-routed):
- `alive.best` (apex, mail)
- `mail.alive.best`, `mx.alive.best` (mail server)
- `autoconfig.alive.best`, `autodiscover.alive.best` (mailcow)
- `int.alive.best` (Server 2, different IP)

### 9. Stop old proxy services

```bash
systemctl stop nginx && systemctl disable nginx
systemctl stop caddy-shell && systemctl disable caddy-shell
# Keep preview-proxy (handles preview auth)
# Keep caddy (handles custom domains + internal image proxy)
# Remove port-map cron:
crontab -l | grep -v "port-map" | crontab -
```

### 10. Configure Caddy

Caddy serves two roles. Both are imported from `/etc/caddy/Caddyfile`:

**`/etc/caddy/Caddyfile`:**
```caddy
{
    admin localhost:2019
}
import /etc/caddy/Caddyfile.custom
import /etc/caddy/Caddyfile.internal
```

**`/etc/caddy/Caddyfile.custom`** — public :443 for direct-IP custom domains:
```caddy
(custom_images) {
    handle_path /_images/* {
        root * /srv/webalive/storage
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }
}

scalotta.it {
    import custom_images
    reverse_proxy localhost:3687
}
# ... other custom domains with `import custom_images`
```

**`/etc/caddy/Caddyfile.internal`** — internal :8444 for tunnel-backed sites:
```caddy
:8444 {
    map {host} {site_upstream} {
        larry.alive.best   "localhost:3456"
        # ... 124+ hostname→port mappings
        *.alive.best       "localhost:5055"
        default            "localhost:5055"
    }

    handle_path /_images/* {
        root * /srv/webalive/storage
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }

    handle_path /files/* {
        root * /srv/webalive/sites/{host}/user/.alive/files
        header Cache-Control "no-cache"
        file_server
    }

    reverse_proxy {site_upstream}
}
```

The `*.alive.best` map entry catches preview subdomains and routes them to preview-proxy (:5055).

## Current state (Server 1)

| Service | Status | Port | Purpose |
|---------|--------|------|---------|
| `cloudflared.service` | **active, enabled** | outbound QUIC | All `*.alive.best` routing (148 ingress rules) |
| `caddy.service` | **active, enabled** | :80/:443 + :8444 | Custom domain TLS + internal image/file proxy |
| `preview-proxy.service` | **active, enabled** | :5055 | Preview iframe JWT auth, session cookies, nav script injection |
| `nginx.service` | **inactive, disabled** | — | No longer needed |
| `caddy-shell.service` | **inactive, disabled** | — | No longer needed |

## Tunnel ingress structure

```text
Explicit site rules (124):     hostname.alive.best → http://localhost:8444
Infrastructure rules (direct):  app/staging/dev/go/oc/services.alive.best → http://localhost:{port}
E2E rule:                       dl1.alive.best → http://localhost:8444
Wildcard:                       *.alive.best → http://localhost:8444
Catch-all:                      (no hostname) → http_status:404
```

Cloudflare routes by specificity: explicit hostnames match first, then wildcards, then the catch-all.

## Package: @webalive/tunnel

Location: `packages/tunnel/`

- `TunnelManager` class: add/remove/update/sync routes via Cloudflare API
- `sync.ts`: bulk sync all DB domains to tunnel (replaces generate-routing.ts)
- Config via env vars: `CF_ACCOUNT_ID`, `CF_TUNNEL_ID`, `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_BASE_DOMAIN`

## Rollback

If the tunnel goes down, re-enable the old stack:

```bash
# 1. Restore old Caddyfile: git checkout /etc/caddy/Caddyfile
# 2. Flip DNS wildcard back to A record (138.201.56.93)
# 3. Re-enable services:
systemctl enable --now nginx caddy caddy-shell
# 4. Disable tunnel:
systemctl disable --now cloudflared
```

## Server 2 (sonno.tech) — TODO

Same steps, different values:
- Server IP: 95.217.89.48
- Domain: sonno.tech
- Create a second tunnel: `alive-server2`
- Zone ID for sonno.tech: look up in Cloudflare dashboard
- Custom domains on Server 2: TBD
- Will need its own `Caddyfile.internal` with sonno.tech hostname→port mappings
