# Claude Bridge - Open Source Readiness Report

**Generated:** 2026-02-03
**Status:** NEEDS CLEANUP BEFORE RELEASE

---

## Executive Summary

A comprehensive security scan was performed across the entire Claude Bridge codebase. The codebase follows **good security practices** with proper environment variable usage, but several categories of sensitive information need cleanup before open-source release.

### Overall Risk Assessment: MODERATE

| Category | Status | Action Required |
|----------|--------|-----------------|
| Production Secrets in Code | ✅ GOOD | None |
| Production .env Files | ⚠️ CRITICAL | Must not be committed |
| Hardcoded Server IP | ⚠️ HIGH | Replace with placeholder |
| Hardcoded Domains | ⚠️ HIGH | Replace with examples |
| License Files | 🔴 CRITICAL | Currently n8n license - WRONG |
| Test Credentials | ✅ GOOD | Properly isolated |

---

## Critical Issues (Must Fix)

### 1. Production .env Files Contain Real Secrets

**Files with REAL production secrets (already gitignored, but verify):**

```
apps/web/.env.production          # Contains all production secrets
apps/web/.env.staging             # Contains staging secrets
apps/web/.env.development         # Contains dev secrets
apps/shell-server-go/.env         # Contains SHELL_PASSWORD
apps/shell-server-go/.env.production
.env.local                        # Contains JWT_SECRET, BRIDGE_PASSCODE
.env.broker                       # Contains BROKER_SHARED_SECRET
```

**Secrets exposed in these files:**
- `ANTH_API_SECRET` (Anthropic API key)
- `JWT_SECRET`
- `LOCKBOX_MASTER_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `DATABASE_PASSWORD`
- `STRIPE_OAUTH_TOKEN`
- `FLOWGLAD_SECRET_KEY`
- `LINEAR_CLIENT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `GROQ_API_SECRET`
- `SHELL_PASSWORD`
- `BROKER_SHARED_SECRET`

**Action Required:**
1. Verify `.gitignore` excludes all these files
2. Run: `git ls-files | grep -E "\.env" | grep -v example` (should return only .example files)
3. **ROTATE ALL SECRETS** if they were ever committed to git history

### 2. License Files Are Wrong

**Current state:** LICENSE and LICENSE_EE.md contain n8n's license (copied incorrectly)

```
# The n8n Enterprise License (the "Enterprise License")
Copyright (c) 2022-present n8n GmbH.
```

**Action Required:**
1. Choose appropriate license (MIT, Apache 2.0, AGPL-3.0, etc.)
2. Replace both LICENSE and LICENSE_EE.md with correct license
3. Update copyright holder

### 3. Hardcoded Server IP Address

**IP:** `138.201.56.93`

**Files affected (13+):**
- `docs/reports/openclaw-installation-report.md`
- `docs/archive/refactoring/UTILITY_LIB_DUPLICATES.md`
- `apps/web/app/docs/dns-setup/page.tsx` (16 occurrences)
- `packages/site-controller/README.md`
- `docs/architecture/dns-verification.md`
- `docs/deployment/site-deployment-*.md`
- `docs/testing/E2E_TESTING.md`
- `scripts/sites/add-verification-files.sh`

**Action Required:**
```bash
# Replace with placeholder
find . -type f \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i 's/138\.201\.56\.93/YOUR_SERVER_IP/g' {} +
```

### 4. Hardcoded Production Domains

**Domains found throughout codebase:**
- `terminal.goalive.nl` (production)
- `staging.terminal.goalive.nl` (staging)
- `dev.terminal.goalive.nl` (development)
- `*.alive.best` (wildcard customer domain)
- `goalive.nl` (main domain)

**Files with hardcoded domains (55+ TypeScript files, 100+ docs):**
- `packages/shared/src/config.ts` - Domain defaults
- `packages/shared/src/environments.ts` - Environment URLs
- `ops/caddy/Caddyfile` - All routing
- `README.md` - Architecture image URL from production
- Multiple test files and documentation

**Action Required:**
Option A: Replace with example.com equivalents:
```bash
find . -type f \( -name "*.md" -o -name "*.ts" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i \
    -e 's/terminal\.goalive\.nl/bridge.example.com/g' \
    -e 's/\.goalive\.nl/.example.com/g' \
    -e 's/alive\.best/yourdomain.com/g' \
    {} +
```

Option B: Keep domains, document they are examples of the production deployment

---

## High Priority Issues

### 5. Customer Domain Names in Docs

**Domains to anonymize:**
- `kranazilie.nl`
- `homable.nl`
- `barendbootsma.com`
- `riggedgpt.com`

**Files:** Various documentation and CLAUDE.md

### 6. Architecture Diagram Hosted on Production

**README.md Line ~12:**
```markdown
![Architecture](https://terminal.goalive.nl/_images/t/larss.alive.best/o/98ba3d55db2b679a/v/orig.webp)
```

**Action Required:**
1. Download image locally to `docs/images/`
2. Update README.md to use local path

### 7. Default "supersecret" Password

**Location:** `packages/shared/src/config.ts`
```typescript
PASSWORD: "supersecret"  // Default for new deployments
```

**Action Required:** Document prominently that this MUST be changed in production

### 8. SQLite Database (use_this_to_remember.db)

Contains internal project notes and decisions. Review for sensitive content before release.

---

## Environment Variables Inventory (148 unique)

### Required Secrets (Must Configure)
```bash
ANTHROPIC_API_KEY=sk-ant-...          # Claude API
SUPABASE_URL=https://xxx.supabase.co  # Database
SUPABASE_ANON_KEY=eyJ...              # Public key
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Admin key (server only)
JWT_SECRET=xxx                         # Session signing
LOCKBOX_MASTER_KEY=xxx                 # OAuth encryption (64 hex chars)
REDIS_URL=redis://:pass@host:6379     # Session store
```

### OAuth Integrations (Optional)
```bash
LINEAR_CLIENT_ID=xxx
LINEAR_CLIENT_SECRET=xxx
STRIPE_CLIENT_ID=xxx
STRIPE_CLIENT_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_WEBHOOK_SECRET=xxx
```

### Configuration (Non-Secret)
```bash
BRIDGE_ENV=local|dev|staging|production
CLAUDE_MODEL=claude-sonnet-4-5
WORKSPACE_BASE=/srv/webalive/sites
SERVER_IP=xxx.xxx.xxx.xxx
WILDCARD_TLD=yourdomain.com
ADMIN_EMAILS=admin@example.com
SUPERADMIN_EMAILS=superadmin@example.com
```

### Client-Exposed (NEXT_PUBLIC_*)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
```

---

## What's Already Good

### Security Patterns ✅
- All secrets loaded from `process.env.*`
- Zod validation for all env vars
- JWT authentication with proper secret management
- AES-256-GCM encryption for OAuth tokens
- Bcrypt for password hashing
- Path traversal protection
- Workspace isolation with dedicated system users

### Test Isolation ✅
- Test emails use `@bridge-vitest.internal`, `@bridge-playwright.internal`
- Test credentials in `.env.test` (copied from `.env.test.example`) are mock values
- Production domains not in test files

### .gitignore ✅
- All sensitive .env files already listed
- Only .example files are tracked

---

## Checklist Before Release

### Critical (Must Do)
- [ ] Replace LICENSE and LICENSE_EE.md with correct license
- [ ] Verify no .env files with secrets are tracked: `git ls-files | grep -E "\.env"`
- [ ] Check git history for secrets: `git log -p --all -S "sk-ant-" -S "eyJhbGciOi"`
- [ ] Replace server IP `138.201.56.93` with `YOUR_SERVER_IP`
- [ ] Download architecture diagram locally

### High Priority
- [ ] Replace/document production domains (`goalive.nl`, `alive.best`)
- [ ] Anonymize customer domain names
- [ ] Review `use_this_to_remember.db` for sensitive notes
- [ ] Document "supersecret" default password is insecure
- [ ] Create comprehensive `.env.example` at repo root

### Recommended
- [ ] Create SECURITY.md with vulnerability reporting process
- [ ] Create DEPLOYMENT.md with setup instructions
- [ ] Add setup script for easy onboarding
- [ ] Consider renaming package scopes (@webalive/* → @claude-bridge/*)

---

## Files to Delete or Clean

### Remove Before Release
```
.env.local                    # Contains local secrets
.env.broker                   # Contains broker secret
apps/web/.env.production      # Production secrets
apps/web/.env.staging         # Staging secrets
apps/web/.env.development     # Dev secrets
apps/shell-server-go/.env     # Shell password
apps/shell-server-go/.env.production
apps/shell-server-go/.env.local
domain-passwords.json         # Port mappings (check content)
use_this_to_remember.db       # Internal notes (review first)
```

### Already Gitignored (Verify)
```bash
git check-ignore .env.production .env.staging .env.development .env.local .env.broker
# Should list all of them
```

---

## Sanitization Script

```bash
#!/bin/bash
# sanitize-for-opensource.sh

echo "🔒 Sanitizing Claude Bridge for open-source release..."

# 1. Replace server IP
find . -type f \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/.builds/*" \
  -exec sed -i 's/138\.201\.56\.93/YOUR_SERVER_IP/g' {} +

# 2. Replace production domains (OPTIONAL - may want to keep as example)
# find . -type f \( -name "*.md" \) \
#   -not -path "*/node_modules/*" \
#   -exec sed -i \
#     -e 's/terminal\.goalive\.nl/bridge.example.com/g' \
#     -e 's/\.goalive\.nl/.example.com/g' \
#     -e 's/alive\.best/yourdomain.com/g' \
#     {} +

# 3. Anonymize customer domains
find docs -type f -name "*.md" -exec sed -i \
  -e 's/kranazilie\.nl/client1.example.com/g' \
  -e 's/homable\.nl/client2.example.com/g' \
  -e 's/riggedgpt\.com/client3.example.com/g' \
  -e 's/barendbootsma\.com/client4.example.com/g' \
  {} +

echo "⚠️  MANUAL STEPS REQUIRED:"
echo "  1. Replace LICENSE and LICENSE_EE.md with correct license"
echo "  2. Download architecture diagram from production to docs/images/"
echo "  3. Update README.md to use local image path"
echo "  4. Review use_this_to_remember.db for sensitive content"
echo "  5. Create root .env.example with all variables"
echo "  6. Verify git history doesn't contain secrets"

echo "✅ Automated sanitization complete"
```

---

## Conclusion

The Claude Bridge codebase is **well-structured for open-source release** with proper secret management. The main work needed is:

1. **Fix the license** (currently wrong)
2. **Sanitize infrastructure-specific values** (IP, domains)
3. **Verify git history** is clean of secrets
4. **Create documentation** for deployment

No production secrets are hardcoded in the source code - all use environment variables as expected.
