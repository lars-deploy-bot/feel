# Stage 2: Localize Assets

## 1. Audit external domains

Find every external domain the HTML references:

```bash
grep -oP 'https?://[a-zA-Z0-9.-]+' index.html | sort -u
```

Categorize each:
- **Asset CDN** (fonts, images, JS, videos) → must download & rewrite
- **Navigation links** (linkedin, twitter, company domain) → leave as-is

## 2. Download missing external assets

Scrapers catch most assets but miss some. Common gaps:

**Fonts** (e.g., fonts.gstatic.com):
```bash
mkdir -p fonts
grep -oP 'https://fonts\.gstatic\.com/[^)"'"'"' ]+' index.html | sort -u | while read url; do
  fname=$(echo "$url" | sed 's|https://fonts.gstatic.com/||; s|/|__|g')
  curl -sL "$url" -o "fonts/$fname"
done
```

**Videos** (e.g., R2/S3/CloudFront CDNs):
```bash
mkdir -p videos
curl -sL "https://cdn.example.com/video.mp4" -o "videos/video.mp4"
```

## 3. Rewrite URLs in HTML

Replace ALL external CDN URLs with local `/cdn/` paths:

```typescript
// In a one-time rewrite script
html = html.replace(/https:\/\/cdn\.example\.com\/images\//g, "/cdn/images/")
html = html.replace(/https:\/\/cdn\.example\.com\/sites\//g, "/cdn/sites/")
html = html.replace(/https:\/\/cdn\.example\.com\/assets\//g, "/cdn/assets/")
html = html.replace(/https:\/\/cdn\.example\.com\/modules\//g, "/cdn/modules/")
// Fonts with path flattening
html = html.replace(/https:\/\/fonts\.gstatic\.com\/([^)"'\s]+)/g, (_, path) => {
  return `/cdn/fonts/${path.replace(/\//g, "__")}`
})
// Videos
html = html.replace(/https:\/\/r2-cdn\.example\.com\/videos\//g, "/cdn/videos/")
```

## 4. Rewrite URLs in ALL JS files (CRITICAL)

**This is where most people fail.** The JS bundles contain hardcoded CDN URLs for dynamic imports — modules, images, and fonts loaded at runtime.

Collect all `.mjs` and `.js` files and apply the same rewrites:

```typescript
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

async function collectFiles(dir: string, exts: string[]): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  for (const entry of entries) {
    if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) {
      files.push(join(entry.parentPath || dir, entry.name))
    }
  }
  return files
}

function rewriteUrls(content: string): string {
  let result = content
  result = result.replace(/https:\/\/cdn\.example\.com\/modules\//g, "/cdn/modules/")
  result = result.replace(/https:\/\/cdn\.example\.com\/images\//g, "/cdn/images/")
  result = result.replace(/https:\/\/cdn\.example\.com\/sites\//g, "/cdn/sites/")
  result = result.replace(/https:\/\/cdn\.example\.com\/assets\//g, "/cdn/assets/")
  // ... same patterns as HTML
  return result
}

const files = await collectFiles("./scraped-dir", [".mjs", ".js"])
for (const file of files) {
  const content = await readFile(file, "utf-8")
  const rewritten = rewriteUrls(content)
  if (content !== rewritten) await writeFile(file, rewritten)
}
```

**Watch for edge cases:**
- Template literals with backticks (`` `https://cdn...` ``) — simple regex may miss these
- URL-encoded characters in paths
- Files with `@` in their names (version suffixes like `icon.js@0.0.57`)

After rewriting, verify zero CDN refs remain:
```bash
grep -r 'https://cdn\.example\.com' ./scraped-dir/ | grep -v '/cdn/' | wc -l
# Must be 0
```

## 5. Merge scraped directories

Scrapers save dynamic imports under an `https/` subdirectory (mirroring the URL path). These need to be merged with the main asset directories:

```bash
# The scraper saved dynamic module imports under https/cdn-domain/modules/
# Merge them into the main modules directory
cp -r scraped/https/cdn-domain/modules/* scraped/main-modules/

# Same for other domain-prefixed directories
cp -r scraped/https/other-domain/* scraped/other-domain/
```

**Delete the rewrite script after running.** It's a one-time tool.
