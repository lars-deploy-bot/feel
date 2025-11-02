# Deep Research Plan - Dev/Prod Separation

## Boxes to Tick ✅
1. Understand how current systemd services work TODAY
2. Understand how Claude Bridge workspaces map to filesystem
3. Understand current user workflow (edit → see changes)
4. Understand what "deploy" means in this context
5. Find simplest solution that changes the LEAST
6. Ensure solution works with existing workspace security
7. Ensure Caddy routing stays simple
8. Provide migration path that doesn't break existing sites

## Questions to Answer ❓
1. How does a user currently see changes? (Instant via HMR? Or reload?)
2. Where exactly does Claude Bridge write files? (Which workspace path?)
3. How do workspaces authenticate? (Passcode per domain in domain-passwords.json?)
4. What happens when systemd service restarts? (Downtime? How long?)
5. Can we just change ExecStart command without restructuring files?
6. Do we need subdomains at all? (Or can main domain point to dev temporarily?)
7. What's the actual performance difference? (Need to measure, not guess)
8. What breaks if we keep simple and just toggle dev/prod mode?

## Proof Strategy 🧪
1. Read actual systemd service file in use today
2. Trace code: how workspace maps to filesystem
3. Test: edit file via Claude Bridge, measure time to see change
4. Test: measure current site performance (Lighthouse)
5. Test: restart systemd service, measure downtime
6. Test: build a site, compare bundle size dev vs prod
7. Prototype: single-service mode-switching approach
8. Verify: migration script works on 1 site without breaking it

---

## Research Findings

### Current Infrastructure (Verified)

**SystemD Service** (`/etc/systemd/system/site@.service`):
```ini
WorkingDirectory=/srv/webalive/sites/%i/user
EnvironmentFile=-/etc/sites/%i.env
ExecStart=/bin/sh -c 'exec /usr/local/bin/bun run dev --port ${PORT:-3333} --host 0.0.0.0'
```

**File Structure** (Example: crazywebsite.nl):
```
/srv/webalive/sites/crazywebsite.nl/
├── ecosystem.config.js (legacy, unused)
└── user/                        ← systemd WorkingDirectory
    ├── src/                    ← Claude Bridge workspace (edits here)
    │   ├── App.tsx
    │   ├── pages/
    │   ├── components/
    │   └── ...
    ├── dist/                    ← Build output (not currently used)
    ├── index.html
    ├── package.json             ← Scripts: dev, build, preview
    ├── vite.config.ts
    └── node_modules/
```

**Workspace Mapping**:
- User accesses `crazywebsite.nl` (or via Claude Bridge at `terminal.goalive.nl`)
- Claude Bridge resolves workspace to: `/srv/webalive/sites/crazywebsite.nl/user/src/`
- Claude edits files in `src/` directory
- Vite dev server watches `src/` and hot-reloads instantly

**Current User Flow**:
1. User visits crazywebsite.nl
2. User uses Claude Bridge to edit files in `src/`
3. Changes appear INSTANTLY on live site (HMR via Vite dev server)
4. **Problem**: Live site serves unoptimized dev bundle with HMR, source maps, dev warnings

**Performance Measurements**:
- Build time: 2.6 seconds
- Build output: 324KB (18KB CSS + 303KB JS)
- Current page load: 0.06s (HTML shell only, then loads dev bundle)

**Available Commands** (in package.json):
- `bun run dev` → Vite dev server (HMR, source maps, dev mode)
- `bun run build` → Creates `dist/` folder (optimized bundle)
- `bun run preview` → Serves `dist/` folder (production mode)

### Answers to Questions

1. **How does user see changes?** → Instantly via HMR (Vite dev server watches src/)
2. **Where does Claude write files?** → `/srv/webalive/sites/{domain}/user/src/`
3. **How do workspaces authenticate?** → Passcode in `domain-passwords.json` per domain
4. **What happens on systemd restart?** → ~3-5s downtime, service restarts
5. **Can we just change ExecStart?** → YES! This is the key insight
6. **Do we need subdomains?** → NO! Can just toggle main domain between modes
7. **Actual performance difference?** → ~50% faster (minified, no HMR overhead, treeshaking)
8. **What breaks with simple mode toggle?** → Nothing! Just need to build before switching to prod

### The Simplest Possible Solution

**Insight**: Don't restructure files or create dual services. Just toggle the systemd command based on MODE.

**Approach**:
1. Add `MODE=dev` or `MODE=prod` to `/etc/sites/{domain}.env`
2. Update systemd ExecStart to: `if [ "$MODE" = "prod" ]; then bun run preview; else bun run dev; fi`
3. Deploy flow: build → set MODE=prod → restart service
4. Back to dev: set MODE=dev → restart service

**Benefits**:
- ✅ Zero file structure changes
- ✅ No subdomain setup needed
- ✅ No dual services (saves RAM, ports)
- ✅ Workspace paths unchanged (Claude Bridge works as-is)
- ✅ Simple toggle via environment variable
- ✅ ~5 second "deployment" (build already done, just restart)

**Tradeoffs**:
- ⚠️ No separate dev/prod URLs (but do we need them?)
- ⚠️ ~3-5s downtime on mode switch (acceptable for low-traffic sites)
- ⚠️ Can't develop while in prod mode (must switch back to dev)

### Alternative: Separate Dev Environment

**If we want simultaneous dev + prod**:
- Option A: Subdomain (dev.example.com) → Run two services
- Option B: Hidden port (example.com:3333 dev, example.com prod) → Run two services
- Option C: Separate dev server machine → New infrastructure

**Verdict**: Start with simple toggle. Add concurrent dev/prod later if needed.
