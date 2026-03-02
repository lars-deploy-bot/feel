# Stage 4: Migrate to src/ (Future)

This stage is for when the scraped site is stable and you want to reorganize it into a clean, maintainable structure with proper `package.json`, `src/` directory, and build pipeline.

**Do NOT start this stage until stages 1-3 are complete and the site works in isolation.**

## Goal

Transform from scraper output → clean project:

```
# Before (scraper mess)
user/
├── index.html
├── wonderful/
│   ├── framerusercontent.com/sites/HASH/...   # 160+ JS files
│   ├── framerusercontent.com/images/...        # 39 images
│   ├── framerusercontent.com/assets/...        # 5 fonts
│   ├── framer.com/m/phosphor-icons/...         # icons
│   ├── fonts/                                  # Google Fonts
│   └── videos/                                 # MP4s
├── cdn/ (symlinks)
├── server.ts
└── package.json

# After (clean project)
user/
├── src/
│   ├── index.html              # Main HTML
│   ├── public/                 # Static assets served at /cdn/
│   │   ├── images/             # All images (flat)
│   │   ├── fonts/              # All fonts (flat)
│   │   ├── videos/             # All videos (flat)
│   │   ├── js/                 # All JS bundles (flat, renamed)
│   │   └── icons/              # Icon components
│   └── runtime/                # Framework runtime files
│       ├── react.mjs
│       ├── motion.mjs
│       ├── framework.mjs
│       └── modules/            # Component modules
├── server.ts
└── package.json
```

## Steps

### 1. Map the dependency graph

Before reorganizing, understand which JS files import which:

```bash
# Find all import paths in the bundle
grep -oP 'from\s*"[^"]*"' scraped/sites/HASH/*.mjs | sort -u
grep -oP 'import\s*"[^"]*"' scraped/sites/HASH/*.mjs | sort -u
```

### 2. Flatten images

Move all images to a flat directory with original filenames:

```bash
mkdir -p src/public/images
cp scraped/cdn-domain/images/* src/public/images/
```

### 3. Flatten fonts

```bash
mkdir -p src/public/fonts
cp scraped/cdn-domain/assets/*.woff2 src/public/fonts/
cp scraped/fonts/*.woff2 src/public/fonts/
```

### 4. Organize JS

This is the hard part. The JS bundle has:
- **Runtime**: react, motion, framework core (~5 files)
- **Page components**: route-specific code (~20 files)
- **Shared components**: carousels, icons, utilities (~30 files)
- **Dynamic modules**: loaded on demand (~80 files)

For now, keep the JS files in their original structure and only reorganize images/fonts/videos. The JS dependency graph is too complex to flatten safely without breaking imports.

### 5. Update server.ts paths

Update `serveStatic` to point to the new `src/public/` directory.

### 6. Update URL rewrites

If you renamed files, update the HTML and JS to reference new paths.

## When to do this

- When you need to modify the site content (not just serve it)
- When you want to add new pages or features
- When the JS framework needs to be updated or replaced
- When the scraper output structure causes maintenance pain

**Don't do this just to be clean.** If the symlink approach works and the site loads, leave it.
