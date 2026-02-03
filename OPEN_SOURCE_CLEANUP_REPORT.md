# Open Source Cleanup Report

Generated: 2026-02-03

## Summary

This report identifies sensitive information in **tracked git files** that needs to be addressed before open sourcing.

---

## CRITICAL: Files to Remove from Git

### 1. SQLite Database with Internal Knowledge
**File:** `use_this_to_remember.db`

Contains internal development decisions, insights, and conversation history. This should NOT be open sourced.

**Action:** Remove from git tracking
```bash
git rm --cached use_this_to_remember.db
echo "use_this_to_remember.db" >> .gitignore
```

### 2. Production Caddyfile with 276 Live Domains
**File:** `ops/caddy/Caddyfile`

Contains routing configuration for 276+ production domains including:
- `*.alive.best` domains
- `*.goalive.nl` domains
- Customer/internal domains

**Action:** Replace with example Caddyfile
```bash
git rm ops/caddy/Caddyfile
git rm ops/caddy/Caddyfile.restore_backup
# Create ops/caddy/Caddyfile.example instead
```

### 3. Caddyfile Backup
**File:** `ops/caddy/Caddyfile.restore_backup`

Same issue as above.

---

## HIGH: Hardcoded Server IP

**IP Address:** `138.201.56.93` (Production server)

Found in 13 tracked files:
- `docs/architecture/dns-verification.md`
- `docs/deployment/site-deployment-architecture.md`
- `docs/deployment/site-deployment-state-machine.md`
- `docs/testing/E2E_TESTING.md`
- `docs/guides/dns-validation-design.md`
- `packages/site-controller/README.md`
- `packages/site-controller/SUMMARY.md`
- `scripts/sites/add-verification-files.sh`
- `apps/web/app/docs/dns-setup/page.tsx`
- `docs/archive/...` (multiple)

**Action:** Replace with placeholder like `YOUR_SERVER_IP` or `203.0.113.1` (RFC 5737 documentation IP)

---

## HIGH: Supabase Project ID in Generated Types

**Project ID:** `qnvprftdorualkdyogka`

Found in:
- `packages/database/src/app.generated.ts`
- `packages/database/src/iam.generated.ts`
- `packages/database/src/integrations.generated.ts`
- `packages/database/src/lockbox.generated.ts`
- `packages/database/src/public.generated.ts`
- `packages/shared/scripts/generate-database-types.ts` (hardcoded fallback)
- `apps/web/lib/supabase/LEARNINGS.md`

**Action:**
1. Remove project ID from generated file comments
2. Remove hardcoded fallback in `generate-database-types.ts` line 28
3. Update script to fail if env var not set

---

## MEDIUM: Production Domain References

Many files reference production domains:
- `terminal.goalive.nl`
- `app.alive.best`
- `*.goalive.nl`
- `*.alive.best`

Found in 55+ TypeScript files for:
- Cookie domain configuration
- OAuth redirect URIs
- Preview URL generation
- Test fixtures

**Action:** Consider using environment variables or configuration for these, or document them clearly as examples.

---

## MEDIUM: Email Address

**Email:** `admin@example.com`

Found in: `docs/prs/github/phase-06-repo-creation.md`

**Action:** Replace with placeholder email

---

## LOW: Example Secrets (OK to Keep)

These files contain placeholder/example secrets and are fine:
- `.env.example` - Contains `sk-ant-...`, `eyJ...`, `gsk_...` placeholders
- `apps/web/.env.example`
- `apps/web/.env.local.example`
- Various `*.example` files

Test files with mock JWTs are also fine:
- `apps/web/lib/auth/__tests__/timing-safe.test.ts`
- `apps/web/tests/setup.ts`
- `packages/tools/test/bridge-api-client.test.ts`

---

## Verified Safe

The following are NOT tracked in git (good):
- `.env` files with real secrets
- `domain-passwords.json`
- Any `.pem`, `.key`, `.p12` files
- Build outputs (`.next/`, `dist/`, `.builds/`)

---

## Recommended Cleanup Script

```bash
#!/bin/bash
# Run from repo root

# 1. Remove SQLite database
git rm --cached use_this_to_remember.db

# 2. Remove production Caddyfile
git rm ops/caddy/Caddyfile
git rm ops/caddy/Caddyfile.restore_backup

# 3. Replace server IP in docs (use RFC 5737 documentation IP)
find docs scripts packages apps -type f \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.sh" \) \
  -exec sed -i 's/138\.201\.56\.93/203.0.113.1/g' {} \;

# 4. Remove Supabase project ID from generated comments
sed -i '/Project: qnvprftdorualkdyogka/d' packages/database/src/*.generated.ts

# 5. Update .gitignore
cat >> .gitignore << 'EOF'

# Sensitive files
use_this_to_remember.db
ops/caddy/Caddyfile
ops/caddy/Caddyfile.restore_backup
EOF

# 6. Create example Caddyfile
cat > ops/caddy/Caddyfile.example << 'EOF'
# WebAlive sites managed by Claude Bridge
# Copy this file to Caddyfile and customize for your domains

(common_headers) {
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        -Server
        -X-Powered-By
    }
}

example.com {
    import common_headers
    reverse_proxy localhost:3333 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF

echo "Cleanup complete. Review changes before committing."
```

---

## Post-Cleanup Verification

After running cleanup, verify with:
```bash
# Check for remaining sensitive patterns
git grep -E "138\.201\.56\.93|qnvprftdorualkdyogka|goalive@goalive\.nl"

# Verify no secrets in tracked files
git grep -E "sk-ant-api[0-9]|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}"

# Check .gitignore covers sensitive files
git status --ignored | grep -E "\.env|Caddyfile|\.db"
```
