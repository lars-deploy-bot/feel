---
name: frontpage
description: Deploy a scraped/exported website as a static frontpage on an Alive site. Strip tracking, flatten structure, serve via Hono.
---

# Frontpage Deployment

Deploy an externally scraped or exported website (HTTrack, SingleFile, browser save-as, etc.) as a working static frontpage on an Alive-managed site.

## Process

### 1. Copy the source files

Copy the scraped directory into the site's `/user/` directory:

```bash
cp -r /path/to/scraped-site /srv/webalive/sites/<domain>/user/<name>
chown -R site-<slug>:site-<slug> /srv/webalive/sites/<domain>/user/<name>
```

### 2. Strip tracking and analytics

Scraped sites carry third-party junk. Delete these directory patterns if present:

| Pattern | What it is | Action |
|---------|-----------|--------|
| `events.*.com/` | Analytics trackers | DELETE |
| `www.googletagmanager.com/` | GTM scripts | DELETE |
| `www.google-analytics.com/` | GA scripts | DELETE |
| `*.comeet.co/`, `*.lever.co/` | Recruitment widgets | DELETE |
| `api.*.com/auth/` | Auth API stubs | DELETE |
| `app.*static.com/` | Editor/CMS chrome | DELETE |

Then strip matching `<script>` tags and `<noscript>` iframes from the HTML:
- Google Tag Manager (inline loader + gtag.js + noscript iframe)
- Analytics event trackers
- Recruitment/careers API scripts
- CMS editor bar loaders

### 3. Check what's actually referenced

Before deleting asset directories, verify the HTML actually references them:

```bash
# Check if local directories are referenced (often they're not — CDN URLs are used instead)
grep -c 'local-dir-name' index.html
```

If the HTML uses absolute CDN URLs (e.g., `https://cdn.example.com/...`), the local copies of those assets are dead weight. Delete them.

**Keep only:**
- The main HTML file(s)
- Any assets actually referenced via relative paths
- Inline data files (base64/SVG) if referenced

### 4. Flatten the directory structure

Scraped sites nest files under domain-named directories (`www.example.com/index.html`). Move the HTML to the site root:

```bash
mv /srv/webalive/sites/<domain>/user/<name>/www.example.com/index.html \
   /srv/webalive/sites/<domain>/user/index.html
rm -rf /srv/webalive/sites/<domain>/user/<name>/
```

### 5. Remove old template files

If the site was previously a Vite/React template, remove all the old files:

```bash
rm -rf src/ dist/ hooks/ components.json eslint.config.js postcss.config.js \
  tailwind.config.ts tsconfig*.json vite.config.ts vite-env.d.ts CLAUDE.md \
  GALLERY-SHOWCASE-README.md
```

### 6. Simplify server.ts

Replace the Vite dev server setup with a minimal Hono static server:

```typescript
import { Hono } from "hono"

const app = new Hono()

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Load HTML at startup (single read, cached in memory)
const htmlPath = new URL("./index.html", import.meta.url).pathname
const html = await Bun.file(htmlPath).text()

app.get("*", (c) => {
  return c.html(html)
})

const PORT = process.env.PORT || 4000

console.log(`Server running on http://localhost:${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
}
```

### 7. Slim down package.json

Strip all unused dependencies. A static frontpage only needs `hono`:

```json
{
  "name": "<site-slug>",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun --watch server.ts",
    "preview": "NODE_ENV=production bun server.ts"
  },
  "dependencies": {
    "hono": "^4.6.16"
  }
}
```

Then reinstall:

```bash
rm -rf node_modules bun.lock
sudo -u site-<slug> bun install --cwd /srv/webalive/sites/<domain>/user
```

### 8. Switch to preview mode and restart

Set systemd override to use `bun run preview` (single server, no Vite):

```bash
mkdir -p /etc/systemd/system/site@<slug>.service.d
cat > /etc/systemd/system/site@<slug>.service.d/override.conf << 'EOF'
[Service]
ExecStart=
ExecStart=/usr/local/bin/bun run preview
EOF
systemctl daemon-reload
systemctl restart site@<slug>.service
```

### 9. Verify

```bash
# Check service is running
systemctl status site@<slug>.service

# Check local response
curl -s http://localhost:<port>/ | head -5

# Check public URL
curl -s https://<domain>/ | head -5
```

## Final structure

```
/srv/webalive/sites/<domain>/user/
├── .alive
├── .gitignore
├── index.html          # The website (single file, assets from CDN)
├── package.json        # Minimal: just hono
├── server.ts           # Minimal: Hono serving index.html
└── node_modules/       # ~4KB (hono only)
```

## Notes

- Memory usage drops from ~175MB (Vite dev) to ~20MB (static Hono)
- If the site has multiple pages, serve them as separate HTML files or handle routing in server.ts
- If assets use relative paths instead of CDN URLs, keep those asset directories and use `serveStatic` from `hono/bun`
