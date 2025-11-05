# Claude Bridge Reorganization Plan

## Current Problems

### 1. Build System Fragility
- Build artifacts (dist.*) pollute source tree
- TypeScript compiles old builds
- Symlink loops when builds fail
- 763 lines of complex bash scripts

### 2. Poor Separation of Concerns
- Bridge deployment mixed with site deployment
- Shared domain-passwords.json for everything
- No clear domain registry structure
- Build and runtime not separated

### 3. Maintenance Difficulty
- 20+ domains in one flat file
- Manual port assignment
- No domain metadata (owner, purpose, etc.)
- Hard to track which domains are active

## Proposed Solutions

### Phase 1: Separate Build from Source (Quick Win)

**Move build artifacts outside source tree:**

```bash
# New structure
/root/webalive/claude-bridge/
├── apps/web/              # Source only (no dist)
├── .builds/               # Build artifacts (gitignored)
│   ├── current -> 20251105-171731/
│   ├── 20251105-171731/
│   ├── 20251105-164731/
│   └── .buildcache/
└── scripts/
```

**Benefits:**
- No TypeScript pollution
- Clean git status
- Faster IDE indexing
- No symlink loops in source

**Implementation:**
```bash
# next.config.js
distDir: process.env.NODE_ENV === "production"
  ? "../../.builds/current"
  : ".next"

# tsconfig.json - remove dist.* exclude (not needed)
```

---

### Phase 2: Domain Registry Restructure (Medium Priority)

**Current:** Flat `domain-passwords.json` (113 lines)

**Proposed:** Structured registry

```
/root/webalive/
├── registry/
│   ├── domains.json          # Domain metadata
│   ├── ports.json            # Port assignments
│   └── credentials.json      # Encrypted passwords
└── claude-bridge/
```

**domains.json structure:**
```json
{
  "sites": {
    "five.goalive.nl": {
      "type": "website",
      "owner": "lars",
      "status": "active",
      "created": "2024-11-01",
      "systemd": "site@five-goalive-nl",
      "workspace": "/srv/webalive/sites/five.goalive.nl/user"
    }
  },
  "services": {
    "terminal.goalive.nl": {
      "type": "bridge",
      "service": "pm2:claude-bridge",
      "workspace": "/root/webalive/claude-bridge"
    }
  }
}
```

**ports.json:**
```json
{
  "allocated": {
    "3333-3356": "sites",
    "8998": "staging",
    "8999": "production"
  },
  "assignments": {
    "five.goalive.nl": 3347,
    "terminal.goalive.nl": 8999
  }
}
```

**Benefits:**
- Clear domain→service mapping
- Metadata for tracking
- Easier to query (CLI tools)
- Separate credentials security

---

### Phase 3: Deployment Separation (High Priority)

**Problem:** One script does everything (291 lines)

**Proposed:** Modular deployment

```
scripts/
├── bridge/
│   ├── build.sh           # Just build
│   ├── deploy.sh          # Build + PM2 restart
│   └── rollback.sh        # Rollback to previous
├── sites/
│   ├── deploy-site.sh     # Deploy one site
│   ├── restart-site.sh    # Restart systemd service
│   └── migrate-to-systemd.sh
└── shared/
    ├── health-check.sh
    └── port-manager.sh
```

**Each script <100 lines, single responsibility**

---

### Phase 4: Better Build Strategy (Long Term)

**Option A: Docker-based builds**
```dockerfile
# Dockerfile.bridge
FROM oven/bun:1.2.22
WORKDIR /app
COPY . .
RUN bun install && bun run build
CMD ["bun", "next", "start"]
```

**Option B: Separate build server**
- CI/CD builds on dedicated server
- Rsync artifacts to production
- No builds on production server

**Option C: Next.js standalone simplification**
```bash
# No atomic builds, use Next.js native
cd apps/web/.next/standalone
node server.js
```

---

## Implementation Priority

### 🔴 High Priority (Do Now)
1. **Move builds outside source tree** (1 hour)
   - Fixes TypeScript issues
   - Cleaner source tree

2. **Split deployment scripts** (2 hours)
   - Separate bridge/sites
   - Easier to debug

### 🟡 Medium Priority (This Week)
3. **Domain registry restructure** (3 hours)
   - Better organization
   - Foundation for automation

4. **CLI management tool** (4 hours)
   ```bash
   bridge domains list
   bridge domains add newsite.com
   bridge sites deploy five.goalive.nl
   bridge bridge deploy
   ```

### 🟢 Low Priority (Later)
5. **Docker/containerization** (1 day)
   - Better isolation
   - Easier scaling

6. **Monitoring dashboard** (2 days)
   - Web UI for domain status
   - Health checks
   - Logs viewer

---

## Migration Path (Zero Downtime)

### Step 1: Build isolation (this can be done now)
```bash
# 1. Create .builds directory
mkdir -p /root/webalive/claude-bridge/.builds

# 2. Update next.config.js to use new path
# 3. Run one build to test
# 4. Git ignore .builds/
# 5. Clean up old dist.*
```

### Step 2: Script refactoring (gradual)
```bash
# Keep old scripts, add new ones
scripts/bridge/deploy.sh  # New modular version
scripts/build-and-serve.sh  # Old (deprecated)
```

### Step 3: Registry migration (data only)
```bash
# Convert domain-passwords.json → registry/
node scripts/migrate-registry.js
```

---

## Decision Points

**You need to decide:**

1. **Build isolation**: Do this now? (Recommended: YES)
2. **Deployment split**: Gradual or big refactor?
3. **Docker**: Worth the complexity for your scale?
4. **CLI tool**: Bun script vs standalone binary?

**My recommendation for immediate action:**
1. Move builds outside source (fixes current issues)
2. Add gitignore for .builds/
3. Keep current scripts but document better
4. Registry restructure as Phase 2

This gives you stability now, room to grow later.
