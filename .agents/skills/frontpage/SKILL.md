---
name: frontpage
description: Deploy a scraped/exported website as a fully self-hosted static frontpage on an Alive site. Strip tracking, rewrite CDN URLs to local, serve via Hono. Multi-stage process.
---

# Frontpage Deployment

Deploy an externally scraped or exported website as a fully self-hosted static frontpage on an Alive-managed site. **No external CDN dependencies** — the site must work in complete isolation.

This is a multi-stage process. Each stage has its own document:

1. [Stage 1: Import & Strip](./stage-1-import-strip.md) — Copy files, delete tracking/analytics junk
2. [Stage 2: Localize Assets](./stage-2-localize-assets.md) — Download missing assets, rewrite ALL URLs to local paths (HTML + JS)
3. [Stage 3: Serve & Verify](./stage-3-serve-verify.md) — Set up Hono server, symlinks, systemd, verify isolation
4. [Stage 4: Migrate to src/](./stage-4-migrate-src.md) — Reorganize into clean `src/` structure (future)

## Critical Rule

**NEVER rely on external CDNs.** All assets (JS, CSS, images, fonts, videos) must be served locally. CDNs go down, change URLs, or get blocked. The site must work if the internet disappears.

## Key Lesson: JS Files Have CDN URLs Too

Scraped websites don't just reference CDN URLs in HTML. **The JS bundles contain hardcoded CDN URLs** for dynamic imports — modules, images, fonts loaded at runtime. You MUST rewrite URLs in ALL files:

- `index.html` — static `<script>`, `<link>`, `<img>` tags
- `*.mjs` / `*.js` — bundled runtime code with dynamic `import()` calls
- Nested `https/` directories — scrapers save dynamic imports here

If you only rewrite the HTML, the site loads but breaks at runtime when JS tries to fetch from dead CDN URLs.

## Quick Summary

```
1. Copy scraped dir → /user/<name>/
2. Delete tracking dirs (analytics, GTM, recruitment, editor chrome)
3. Strip tracking <script> tags from HTML
4. Download fonts/videos that weren't scraped
5. Rewrite ALL CDN URLs → /cdn/ paths (in HTML AND all JS files)
6. Create cdn/ symlinks → asset directories
7. Write minimal Hono server with serveStatic + MIME fix
8. Slim package.json to just hono
9. Switch systemd to preview mode
10. Verify: zero external asset URLs remain
```
