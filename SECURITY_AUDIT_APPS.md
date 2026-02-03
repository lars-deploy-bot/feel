# Security Audit: Environment Variables and Secrets Scan
**Target Directories:** `apps/{broker,shell-server-go,mcp-servers,image-processor,widget-dev,widget-server}`

## SCAN METADATA
- **Total source files scanned:** 8,099
- **Scan date:** 2026-02-03
- **Directories:** 6 app directories

---

## 🔴 CRITICAL FINDINGS (MUST FIX BEFORE OPEN SOURCE)

### 1. PRODUCTION SECRETS IN REPOSITORY

#### File: `/root/webalive/claude-bridge/apps/shell-server-go/.env.production`
```env
PORT=3888
SHELL_PASSWORD=your-secret-here
NODE_ENV=production
```
- 🔴 **Production password exposed in repository**
- 🔴 **Must be removed and added to .gitignore**

#### File: `/root/webalive/claude-bridge/apps/shell-server-go/.env`
```env
SHELL_PASSWORD=your-secret-here
```
- 🔴 **Production password exposed in repository**
- 🔴 **Must be removed and added to .gitignore**

#### File: `/root/webalive/claude-bridge/apps/shell-server-go/.env.local`
```env
PORT=3500
SHELL_PASSWORD=devpassword
NODE_ENV=development
```
- 🟡 **Development password** (acceptable if clearly marked as example)

---

## 📋 ENVIRONMENT VARIABLES INVENTORY

### apps/broker
**Environment variables used:**
- `BROKER_PORT` - Optional: Server port (default from config)
- `BROKER_HOST` - Optional: Server host (default 127.0.0.1)
- `BROKER_SHARED_SECRET` - **REQUIRED**: Shared secret for internal auth between Next.js and broker

**Configuration status:**
- ✅ Has `.env.example` with safe placeholders
- ✅ Fails gracefully if `BROKER_SHARED_SECRET` missing
- ✅ No hardcoded secrets found

### apps/shell-server-go
**Environment variables used:**
- `NODE_ENV` - Environment selection (development/production)
- `PORT` - Optional: Override port from config
- `SHELL_PASSWORD` - **REQUIRED**: Authentication password

**Configuration status:**
- 🔴 `.env.production` contains production secrets
- 🔴 `.env` contains production secrets
- 🟡 `.env.local` contains dev password (acceptable)
- ⚠️  No `.env.example` file

### apps/mcp-servers/google-scraper
**Environment variables used:**
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` - Optional: Skip browser download
- `PUPPETEER_CACHE_DIR` - Optional: Cache directory for browser binaries
- `PUPPETEER_EXECUTABLE_PATH` - Optional: Custom Chromium path
- `CI` - Optional: CI environment detection
- `GITHUB_ACTIONS` - Optional: GitHub Actions detection
- `HOME` / `USERPROFILE` - Standard system vars

**Configuration status:**
- ✅ All variables are optional with safe defaults
- ✅ No secrets required
- ✅ No hardcoded credentials

### apps/image-processor
**Environment variables used:**
- None (runs on hardcoded port 5012)

**Configuration status:**
- ✅ Completely standalone
- ✅ No environment variables
- ✅ No secrets

### apps/widget-dev
**Environment variables used:**
- None detected

**Configuration status:**
- ✅ Likely static development app
- ✅ No environment variables found

### apps/widget-server
**Environment variables used:**
- `PORT` - Optional: Server port (default 5050)

**Configuration status:**
- ✅ No secrets required
- ✅ Single optional variable with safe default

---

## 🌐 HARDCODED URLS (SAFE - BUT SHOULD BE DOCUMENTED)

### Production Service URLs
**File:** `apps/widget-server/main.go`
- `https://alive.best` - Public marketing URL (safe)
- `https://terminal.goalive.nl/chat` - Public chat interface (safe)
- `https://api.qrserver.com/v1/create-qr-code/` - External API (safe)

**File:** `apps/mcp-servers/*/README.md` (multiple)
- `http://localhost:*` - Development URLs (safe, documentation only)

🟢 **All URLs are either public or localhost development URLs**

---

## 🔍 OTHER SENSITIVE DATA CHECKS

### Hardcoded IP Addresses
❌ None found in scanned directories

### Email Addresses
❌ None found (only package names like `@webalive/*` which are safe)

### Database Connection Strings
❌ None found in scanned directories

### Private Keys / Certificates
❌ None found in scanned directories

---

## 📝 RECOMMENDATIONS

### 🔴 CRITICAL (MUST DO BEFORE OPEN SOURCE)

#### 1. Remove production secrets from repository
```bash
# Remove .env files with production secrets
rm apps/shell-server-go/.env.production
rm apps/shell-server-go/.env

# Add to .gitignore (if not already present)
echo "apps/shell-server-go/.env" >> .gitignore
echo "apps/shell-server-go/.env.production" >> .gitignore
echo "apps/shell-server-go/.env.local" >> .gitignore

# Purge from git history (WARNING: rewrites history)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch apps/shell-server-go/.env*' \
  --prune-empty --tag-name-filter cat -- --all

# Alternative: Use BFG Repo-Cleaner (faster, safer)
# bfg --delete-files '.env*' --no-blob-protection
```

#### 2. Create .env.example files
```bash
# For shell-server-go
cat > apps/shell-server-go/.env.example << 'ENVEXAMPLE'
# Shell Server Environment Variables
# Copy to .env and fill in values:
#   cp apps/shell-server-go/.env.example apps/shell-server-go/.env

# Required: Authentication password
# Generate with: openssl rand -base64 32
SHELL_PASSWORD=your-secret-here

# Optional: Override port from config.json
# PORT=3888

# Environment (development|production)
NODE_ENV=development
ENVEXAMPLE
```

### 🟠 HIGH PRIORITY

#### 3. Document all environment variables
- Create comprehensive `ENV.md` in each app directory
- List all variables with required/optional status
- Provide generation commands for secrets
- Document defaults and validation rules

**Example template:**
```markdown
# Environment Variables

## Required Variables
- `SHELL_PASSWORD` - Authentication password (generate: `openssl rand -base64 32`)

## Optional Variables
- `PORT` - Server port (default: from config.json)
- `NODE_ENV` - Environment mode (default: development)

## Configuration
1. Copy `.env.example` to `.env`
2. Generate secrets using provided commands
3. Fill in production values
4. Never commit `.env` files
```

#### 4. Add pre-commit hooks
```bash
# Add to .husky/pre-commit or similar

# Block commits containing actual .env files (not .env.example)
if git diff --cached --name-only | grep -E '\.env$|\.env\.(local|production|staging)$'; then
  echo "ERROR: Attempted to commit .env file. Only .env.example files are allowed."
  exit 1
fi

# Scan for patterns like hardcoded base64 secrets
if git diff --cached | grep -E 'PASSWORD=.{32,}'; then
  echo "WARNING: Potential secret detected in commit. Please review."
  exit 1
fi
```

### 🟡 MEDIUM PRIORITY

#### 5. Configuration consistency
- `broker` has good `.env.example` - use as template for other apps
- Add `.env.example` to all apps that need env vars
- Standardize naming conventions across all apps

#### 6. Security documentation
- Document secret rotation procedures
- Document which secrets are shared vs per-app
- Add deployment guide showing where to set secrets in production
- Create a central secrets management document

---

## ✅ CLEAN FINDINGS (GOOD PRACTICES)

- ✅ **broker:** Has `.env.example`, no hardcoded secrets
- ✅ **image-processor:** No environment variables needed
- ✅ **widget-server:** Simple config, no secrets
- ✅ **mcp-servers:** Sensible optional variables only
- ✅ No database credentials hardcoded
- ✅ No API keys hardcoded
- ✅ No private keys found
- ✅ URLs are public or localhost only

---

## 🎯 SUMMARY

### Status: ⚠️ NOT READY FOR OPEN SOURCE

**Critical blockers:**
1. Production `SHELL_PASSWORD` exposed in 2 files
2. Missing `.env.example` for `shell-server-go`

**After fixes required:**
- Remove `.env*` files from `shell-server-go` (except `.env.example`)
- Purge from git history
- Add comprehensive environment variable documentation
- Test that all apps start with `.env.example` configurations
- Rotate exposed production password

**Estimated time to fix:** 30 minutes

**Validation checklist:**
- [ ] All `.env` files (non-example) removed from repository
- [ ] All `.env.example` files created with safe placeholders
- [ ] Git history purged of sensitive files
- [ ] `.gitignore` updated to prevent future commits
- [ ] Production secrets rotated (since they were exposed)
- [ ] Documentation added for all environment variables
- [ ] Pre-commit hooks added to prevent future leaks

---

**Audit completed by:** Claude Agent (Sonnet 4.5)
**Scan coverage:** 8,099 files across 6 app directories
**Report generated:** 2026-02-03
