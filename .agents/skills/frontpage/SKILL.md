---
name: frontpage
description: Deploy a scraped frontpage as a fully self-hosted static site on Alive. Strip tracking, rewrite CDN URLs to local, serve via Hono.
---

# Frontpage Deployment

Deploy a scraped frontpage as a fully self-hosted static site. The scraper output follows a specific structure with assets on a CDN domain (e.g. `sitecdn.example.com`) and runtime code on a platform domain (e.g. `sitemaker.example.com`).

**No external CDN dependencies.** The site must work if every external server disappears.

Stages:
1. **Import & Strip** (this file) — copy, delete junk, strip tracking
2. [Localize & Serve](./localize.md) — rewrite URLs, download assets, serve locally, verify isolation
3. [Rebuild as Components](./rebuild.md) — migrate to clean Vite + React project (future)

---

## Critical Rules

1. **NEVER rely on external CDNs.** All assets served locally.
2. **Rewrite URLs in JS too.** HTML is not enough — bundled `.mjs` files contain 1000+ hardcoded CDN URLs for dynamic `import()` calls, lazy-loaded images, and runtime font loading.
3. **Block search engines.** These are reproductions. Always add `X-Robots-Tag: noindex, nofollow` and a blocking `robots.txt`.
4. **Fix file ownership.** All files must be owned by the site user (`site-<slug>`).
5. **Merge `https/` subdirectories.** Scrapers save dynamic imports under `sites/HASH/https/` mirroring the URL structure. These must be merged into the main asset directories or they 404.

---

## Stage 1: Import & Strip

### 1.1 Copy source files

```bash
cp -r /path/to/scraped-site /srv/webalive/sites/<domain>/user/<name>
chown -R site-<slug>:site-<slug> /srv/webalive/sites/<domain>/user/<name>
```

### 1.2 Expected scraper directory structure

The scraper organizes files by origin domain:

```
<name>/
├── www.example.com/              # Main HTML (index.html)
├── sitecdn.example.com/          # Primary CDN — images, JS bundles, modules, assets
│   ├── images/                   # Uploaded images (~40 files)
│   ├── sites/HASH/               # JS bundle (react, motion, page components, ~163 .mjs files)
│   │   └── https/                # Dynamic imports captured by scraper (see 1.3)
│   ├── modules/                  # ES module packages (icon libs, utils)
│   └── assets/                   # Font files (.woff2)
├── sitemaker.example.com/        # Runtime bootstrap + icon packages
│   └── m/                        # Icon packages, module components
├── fonts.gstatic.com/            # Google Fonts (sometimes missed by scraper)
├── _DataURI/                     # Base64-encoded inline assets (usually not needed)
├── www.googletagmanager.com/     # GTM (junk — delete)
├── events.example.com/           # Analytics (junk — delete)
└── other-tracking-domains/       # Various trackers (junk — delete)
```

### 1.3 The `https/` subdirectory problem

Scrapers capture dynamically-imported modules at runtime and save them mirroring the URL path:

```
sitecdn.example.com/sites/HASH/https/
├── sitecdn.example.com/
│   └── modules/                  # Dynamic module imports (icon libs, utils)
│       ├── icon-lib@0.0.57/      # Note: @ in directory names
│       └── other-lib/
└── sitemaker.example.com/
    └── m/                        # Icon component packages
        ├── phosphor-icons/
        └── other-icons/
```

These MUST be merged into the main directories (Stage 2, step 2.4) or dynamic imports will 404.

### 1.4 Delete junk directories

Delete on sight — these are never needed:

| Directory pattern | What it is |
|-------------------|-----------|
| `www.googletagmanager.com/` | Google Tag Manager |
| `www.google-analytics.com/` | Google Analytics |
| `events.*.com/` | Analytics event trackers |
| `*.comeet.co/`, `*.lever.co/` | Recruitment widgets |
| `*.hotjar.com/`, `*.intercom.io/` | Support/heatmap widgets |
| `*.sentry.io/` | Error tracking |
| `_DataURI/` | Base64-encoded inline assets (not referenced by served HTML) |
| `www.<domain>/` | Original unrewritten HTML source (keep only the rewritten copy) |
| `sitemaker.example.com/edit/` | CMS editor runtime (not needed for static serving) |

### 1.5 Strip tracking from HTML

The main HTML file (typically 10,000–15,000 lines) contains inline tracking. Remove:

- **Google Tag Manager**: `<script>` loader + `<noscript>` iframe
- **Google Analytics**: `gtag.js` async script + config block
- **Event trackers**: `<script>` tags referencing analytics domains
- **Recruitment APIs**: career widget scripts (comeet, lever)
- **Preconnect hints**: `<link rel="preconnect">` to external domains (useless when self-hosting)
- **Comment wrappers**: headStart/bodyStart/snippet wrapper comments

### 1.6 Remove old template files

If the site slot previously had a Vite/React template:

```bash
rm -rf src/ dist/ hooks/ components.json eslint.config.js postcss.config.js \
  tailwind.config.ts tsconfig*.json vite.config.ts vite-env.d.ts CLAUDE.md \
  GALLERY-SHOWCASE-README.md .git .gitignore
```
