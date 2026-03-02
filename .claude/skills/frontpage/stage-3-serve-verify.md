# Stage 3: Serve & Verify

## 1. Create cdn/ symlinks

Create a `cdn/` directory with symlinks pointing to the scraped asset directories:

```bash
mkdir -p cdn
ln -sf ../scraped/cdn-domain/images cdn/images
ln -sf ../scraped/cdn-domain/sites cdn/sites
ln -sf ../scraped/cdn-domain/assets cdn/assets
ln -sf ../scraped/merged-modules cdn/modules
ln -sf ../scraped/other-domain cdn/other
ln -sf ../scraped/fonts cdn/fonts
ln -sf ../scraped/videos cdn/videos
```

Symlinks keep the directory clean and avoid file duplication.

## 2. Write server.ts

Minimal Hono server serving HTML + local static assets:

```typescript
import { Hono } from "hono"
import { serveStatic } from "hono/bun"

const app = new Hono()

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Fix MIME types for files with @ in path (e.g., icon.js@0.0.57)
app.use("/cdn/*", async (c, next) => {
  await next()
  const path = c.req.path
  if (path.endsWith(".js") || path.includes(".js@") || path.includes(".mjs")) {
    c.header("Content-Type", "application/javascript; charset=utf-8")
  }
})

// Serve local assets
app.use("/cdn/*", serveStatic({ root: "./" }))

// Serve the website HTML for all other routes
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

**MIME type gotcha:** Scraped files often have `@` in filenames (version suffixes like `icon.js@0.0.57`). Static file servers don't recognize these as JS, returning `application/octet-stream`. The browser refuses to execute them as modules. The middleware above fixes this.

## 3. Slim package.json

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

Reinstall:
```bash
rm -rf node_modules bun.lock
sudo -u site-<slug> bun install --cwd /srv/webalive/sites/<domain>/user
```

## 4. Switch systemd to preview mode

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

## 5. Verify isolation

```bash
# Service running?
systemctl status site@<slug>.service

# HTML serves?
curl -s http://localhost:<port>/ | head -5

# Assets serve with correct MIME?
curl -s -o /dev/null -w "%{http_code} %{content_type}" http://localhost:<port>/cdn/images/some-image.png
curl -s -o /dev/null -w "%{http_code} %{content_type}" "http://localhost:<port>/cdn/other/m/icons/Icon.js@0.0.57"

# CRITICAL: verify no external asset URLs remain in HTML
grep -oP 'https?://[a-zA-Z0-9.-]+' index.html | sort -u
# Only navigation links should remain (linkedin, twitter, company domain)

# CRITICAL: verify no external asset URLs remain in JS
grep -r 'https://cdn\.example\.com' ./scraped-dir/ | wc -l
# Must be 0

# Check public URL
curl -s https://<domain>/ | head -5
```

## 6. Fix ownership

```bash
chown -R site-<slug>:site-<slug> /srv/webalive/sites/<domain>/user/
```

## Final structure

```
/srv/webalive/sites/<domain>/user/
├── .alive
├── index.html              # The website (all URLs rewritten to /cdn/)
├── package.json            # Minimal: just hono
├── server.ts               # Hono: HTML + /cdn/* static + MIME fix
├── cdn/                    # Symlinks to asset directories
│   ├── images -> ../scraped/...
│   ├── sites -> ../scraped/...
│   ├── modules -> ../scraped/... (merged)
│   ├── assets -> ../scraped/...
│   ├── fonts -> ../scraped/fonts
│   └── videos -> ../scraped/videos
├── scraped/                # Original scraped assets (source of truth)
│   ├── cdn-domain/         # Scraped CDN files (JS, CSS, images, modules)
│   ├── fonts/              # Downloaded font files
│   └── videos/             # Downloaded video files
└── node_modules/           # ~4KB (hono only)
```

## Performance notes

- Memory: ~20MB (vs ~175MB for Vite dev mode)
- HTML cached in memory at startup (single read)
- Static files served directly from disk via Bun
- Console warnings about editor bars or CMS tools are harmless — those were stripped
