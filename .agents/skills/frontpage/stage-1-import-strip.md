# Stage 1: Import & Strip

## 1. Copy the source files

```bash
cp -r /path/to/scraped-site /srv/webalive/sites/<domain>/user/<name>
chown -R site-<slug>:site-<slug> /srv/webalive/sites/<domain>/user/<name>
```

## 2. Delete tracking directories

Scraped sites carry third-party junk organized by domain. Delete on sight:

| Pattern | What it is | Action |
|---------|-----------|--------|
| `events.*.com/` | Analytics trackers | DELETE |
| `www.googletagmanager.com/` | GTM scripts | DELETE |
| `www.google-analytics.com/` | GA scripts | DELETE |
| `*.comeet.co/`, `*.lever.co/` | Recruitment widgets | DELETE |
| `api.*.com/auth/` | Auth API stubs | DELETE |
| `app.*static.com/` | Editor/CMS chrome | DELETE |

## 3. Strip tracking from HTML

Remove these script blocks and tags from the main HTML:

- Google Tag Manager (inline loader script + gtag.js `<script async>` + `<noscript>` iframe)
- Analytics event trackers (`<script>` tags referencing events/analytics domains)
- Recruitment/careers API scripts (comeet, lever, etc.)
- CMS editor bar loaders (localStorage checks for editor UI)
- `<link rel="preconnect">` hints to external domains (useless when self-hosting)
- headStart/bodyStart/snippet wrapper comments (clean up noise)

## 4. Remove old template files

If the site was previously a Vite/React template, delete everything that's now unused:

```bash
rm -rf src/ dist/ hooks/ components.json eslint.config.js postcss.config.js \
  tailwind.config.ts tsconfig*.json vite.config.ts vite-env.d.ts CLAUDE.md \
  GALLERY-SHOWCASE-README.md .git .gitignore
```
