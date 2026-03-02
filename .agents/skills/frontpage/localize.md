# Stage 2: Localize & Serve

After stripping junk (Stage 1), make the site fully self-hosted.

---

## 2.1 Audit external domains

```bash
grep -oP 'https?://[a-zA-Z0-9.-]+' index.html | sort -u
```

Expected asset domains to localize:

| Domain | Contains |
|--------|----------|
| `sitecdn.example.com` | Images, JS bundles (`sites/HASH/`), modules, font assets |
| `sitemaker.example.com` | Runtime bootstrap JS, icon packages, CMS config |
| `app.sitemaker-static.example.com` | Editor/CMS runtime chunks (referenced in `edit/init.mjs`) |
| `fonts.gstatic.com` | Google Fonts (woff2) |
| R2/S3/CloudFront URLs | Background videos |

Navigation links (linkedin, twitter, company site) → leave as-is.

## 2.2 Download missing external assets

Scrapers miss some assets. Check for:

**Fonts** (fonts.gstatic.com):
```bash
mkdir -p <name>/fonts
grep -oP 'https://fonts\.gstatic\.com/[^)"'"'"' ]+' index.html | sort -u | while read url; do
  fname=$(echo "$url" | sed 's|https://fonts.gstatic.com/||; s|/|__|g')
  curl -sL "$url" -o "<name>/fonts/$fname"
done
```

**Videos** (R2, S3, CloudFront, Vimeo CDN):
```bash
mkdir -p <name>/videos
# Find video URLs in HTML (look for .mp4, .webm)
grep -oP 'https://[^"'"'"' ]+\.mp4' index.html | sort -u | while read url; do
  fname=$(basename "$url")
  curl -sL "$url" -o "<name>/videos/$fname"
done
```

**Images** not caught by scraper — check 404s in browser console after first load.

## 2.3 Rewrite ALL URLs — HTML AND JS

**This is the most important step.** Write a one-time rewrite script.

### HTML rewriting

```typescript
let html = await Bun.file("./<name>/www.example.com/index.html").text()

// CDN assets → local /cdn/ paths
html = html.replace(/https:\/\/sitecdn\.example\.com\/images\//g, "/cdn/images/")
html = html.replace(/https:\/\/sitecdn\.example\.com\/sites\//g, "/cdn/sites/")
html = html.replace(/https:\/\/sitecdn\.example\.com\/modules\//g, "/cdn/modules/")
html = html.replace(/https:\/\/sitecdn\.example\.com\/assets\//g, "/cdn/assets/")

// Platform runtime → local /cdn/platform/
html = html.replace(/https:\/\/sitemaker\.example\.com\//g, "/cdn/platform/")

// Fonts with path flattening (/ → __ in filename)
html = html.replace(/https:\/\/fonts\.gstatic\.com\/([^)"'\s]+)/g, (_, path) => {
  return `/cdn/fonts/${path.replace(/\//g, "__")}`
})

// Videos (adapt URL pattern to actual site)
html = html.replace(/https:\/\/video-cdn\.example\.com\/([^"')\s]+)/g, "/cdn/videos/$1")

await Bun.write("./index.html", html)
```

### JS rewriting (CRITICAL — most people miss this)

Bundled `.mjs` files contain **1000+ hardcoded CDN URLs** for:
- Dynamic `import()` calls (lazy-loaded page sections)
- Image URLs constructed at runtime
- Font loading
- Module resolution

Apply the **same URL rewrites** to ALL `.mjs` and `.js` files:

```typescript
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith(".mjs") || entry.name.endsWith(".js"))) {
      files.push(join(entry.parentPath || dir, entry.name))
    }
  }
  return files
}

const files = await collectFiles("./<name>")
let count = 0
for (const file of files) {
  const content = await readFile(file, "utf-8")
  const rewritten = rewriteUrls(content) // same replacements as HTML
  if (content !== rewritten) { await writeFile(file, rewritten); count++ }
}
console.log(`Rewrote ${count} JS files`)
```

**Edge cases to handle:**
- Template literals with backticks — regex may miss these
- **Bootstrap config**: `sitemaker.example.com/bootstrap.*.js` contains a config object with `userContent` and `modulesCDN` URLs pointing to the CDN, plus `app`, `login`, and `modulesShortLink` URLs pointing to the platform domain. Rewrite all of these.
- **Icon re-exports**: Files in `sitemaker.example.com/m/phosphor-icons/*.js@*` contain `export * from "https://sitecdn.example.com/modules/..."` — these must be rewritten to `/cdn/modules/...`
- **Static editor domain**: Referenced in `sitemaker.example.com/edit/init.mjs` (CMS editor). Delete the `edit/` directory instead of rewriting.
- After regex pass, do a `sed` catch-all on remaining files:
  ```bash
  find ./<name> -name "*.mjs" -o -name "*.js" -o -name "*.html" | xargs sed -i \
    's|https://sitecdn\.example\.com/|/cdn/|g; s|https://sitemaker\.example\.com/|/cdn/platform/|g'
  ```
- Files with `@` in names (version suffixes like `icon.js@0.0.57`)

**Verify zero CDN refs remain:**
```bash
grep -r 'sitecdn\.example\.com' ./<name>/ | wc -l       # Must be 0
grep -r 'https://sitemaker\.example\.com' ./<name>/ | wc -l  # Must be 0
grep -r 'fonts\.gstatic\.com' ./index.html | wc -l      # Must be 0
```

## 2.4 Merge scraped `https/` directories

Dynamic imports are saved under `sites/HASH/https/` mirroring the URL path. Merge into main dirs:

```bash
# Modules: merge dynamic imports into main modules dir
HASH="abc123"  # Find the actual hash in the sites/ dir
cp -r <name>/sitecdn.example.com/sites/$HASH/https/sitecdn.example.com/modules/* \
  <name>/sitecdn.example.com/modules/

# Icons/runtime: merge into platform dir
cp -r <name>/sitecdn.example.com/sites/$HASH/https/sitemaker.example.com/* \
  <name>/sitemaker.example.com/
```

**How to find the HASH:** `ls <name>/sitecdn.example.com/sites/` — there's usually one directory.

## 2.5 Create cdn/ symlinks

```bash
mkdir -p cdn
ln -sf ../<name>/sitecdn.example.com/images cdn/images
ln -sf ../<name>/sitecdn.example.com/sites cdn/sites
ln -sf ../<name>/sitecdn.example.com/modules cdn/modules
ln -sf ../<name>/sitecdn.example.com/assets cdn/assets
ln -sf ../<name>/sitemaker.example.com cdn/platform
ln -sf ../<name>/fonts cdn/fonts
ln -sf ../<name>/videos cdn/videos
```

## 2.6 Write server.ts

```typescript
import { Hono } from "hono"
import { serveStatic } from "hono/bun"

const app = new Hono()

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Block search engines — this is a reproduction, not the original
app.use("*", async (c, next) => {
  await next()
  c.header("X-Robots-Tag", "noindex, nofollow")
})

app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nDisallow: /\n")
})

// Fix MIME types for files with @ in path (e.g., icon.js@0.0.57)
app.use("/cdn/*", async (c, next) => {
  await next()
  const path = c.req.path
  if (path.endsWith(".js") || path.includes(".js@") || path.includes(".mjs")) {
    c.header("Content-Type", "application/javascript; charset=utf-8")
  }
})

app.use("/cdn/*", serveStatic({ root: "./" }))

// Serve HTML for all other routes
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

**Why `robots.txt` + `X-Robots-Tag`:** These are cloned sites. Without blocking, search engines index them, causing duplicate content penalties for the original and potential legal issues.

**Why the MIME fix middleware:** Scraped files have `@` in filenames (version suffixes). Static file servers return `application/octet-stream` for these. Browsers refuse to execute them as ES modules.

## 2.7 Slim package.json

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

```bash
rm -rf node_modules bun.lock
sudo -u site-<slug> bun install --cwd /srv/webalive/sites/<domain>/user
```

## 2.8 Switch systemd to preview mode

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

## 2.9 Verify isolation

```bash
# Service running?
systemctl status site@<slug>.service

# HTML serves?
curl -s http://localhost:<port>/ | head -5

# Assets serve with correct MIME?
curl -s -o /dev/null -w "%{http_code} %{content_type}" http://localhost:<port>/cdn/images/example.png

# Robots blocked?
curl -s http://localhost:<port>/robots.txt

# CRITICAL: no external asset URLs in HTML
grep -oP 'https?://[a-zA-Z0-9.-]+' index.html | sort -u
# Only navigation links (linkedin, twitter, company domain) should remain

# CRITICAL: no CDN refs in JS
grep -r 'sitecdn\.example\.com' ./<name>/ | wc -l  # Must be 0
grep -r 'https://sitemaker\.example\.com' ./<name>/ | wc -l  # Must be 0
```

## 2.10 Fix ownership & cleanup

```bash
chown -R site-<slug>:site-<slug> /srv/webalive/sites/<domain>/user/
rm rewrite.ts  # Delete one-time script
```

## Final structure

```
/srv/webalive/sites/<domain>/user/
├── .alive
├── index.html              # All URLs rewritten to /cdn/
├── package.json            # Just hono
├── server.ts               # Hono + robots + MIME fix + serveStatic
├── cdn/                    # Symlinks → asset dirs
│   ├── images -> ../<name>/sitecdn.example.com/images
│   ├── sites -> ../<name>/sitecdn.example.com/sites
│   ├── modules -> ../<name>/sitecdn.example.com/modules
│   ├── assets -> ../<name>/sitecdn.example.com/assets
│   ├── platform -> ../<name>/sitemaker.example.com
│   ├── fonts -> ../<name>/fonts
│   └── videos -> ../<name>/videos
├── <name>/                 # Original scraped assets
│   ├── sitecdn.example.com/     # Images, JS bundles, modules, font files
│   ├── sitemaker.example.com/   # Runtime bootstrap, icon packages
│   ├── fonts/                   # Downloaded Google Fonts
│   └── videos/                  # Downloaded background videos
└── node_modules/           # ~4KB
```

Memory: ~20MB (vs ~175MB for Vite dev mode).
