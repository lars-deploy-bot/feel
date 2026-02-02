# Consolidate Sources of Truth

**Status:** Pending
**Priority:** High
**Created:** 2026-02-01

## Summary

Multiple constants and configurations are duplicated across the codebase, creating maintenance burden and potential for inconsistency. This PR tracks the consolidation effort.

## Completed

### Templates (done)
Created `packages/shared/src/templates.ts` as single source of truth.

**Files updated:**
- `packages/shared/src/templates.ts` - NEW canonical definitions
- `packages/shared/src/index.ts` - Added exports
- `packages/tools/src/tools/ai/ask-website-config.ts` - Now imports from shared
- `apps/web/app/ui/previews/WebsiteConfigPreview.tsx` - Now imports from shared
- `packages/tools/src/tools/workspace/create-website.ts` - Uses helper functions
- `packages/tools/src/tools/meta/tool-registry.ts` - Uses helper functions

## Pending Work

### 1. Reserved Slugs (CRITICAL - Security Gap)

**Problem:** 3 different lists with different contents:

| File | Count | Notes |
|------|-------|-------|
| `packages/tools/src/tools/workspace/create-website.ts` | 44 slugs | |
| `apps/web/features/deployment/types/guards.ts` | 44 slugs | Duplicate |
| `apps/web/features/deployment/lib/slug-utils.ts` | 24 slugs | **MISSING 20 SLUGS!** |

**Missing from slug-utils.ts:** `ftp`, `smtp`, `pop`, `imap`, `webmail`, `cpanel`, `whm`, `blog`, `forum`, `shop`, `store`, `media`, `files`, `download`, `uploads`, `dev`, `docs`, `help`, `support`, `ping`, `metrics`, `callback`

**Security impact:** Validation may use wrong list, allowing deployment to "reserved" slugs.

**Fix:** Create `packages/shared/src/reserved-slugs.ts`, update all 3 files to import from it.

---

### 2. API Error Responses (105 occurrences)

**Problem:** Same error patterns repeated across 21+ API routes:
```typescript
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
return NextResponse.json({ error: "Internal server error" }, { status: 500 })
```

**Fix:** `apps/web/lib/api/responses.ts` exists but isn't used consistently. Enforce usage.

---

### 3. Port Numbers (20+ locations)

**Problem:** Ports hardcoded in:
- `apps/web/package.json` scripts
- `ops/systemd/*.service` files
- `ops/caddy/Caddyfile`
- `Makefile`

**Fix:** Generate deployment configs from `packages/shared/src/config.ts`.

---

### 4. Database Schema Names (67 files)

**Problem:** Table names like `iam.users`, `app.domains` scattered across codebase.

**Fix:** Create `packages/shared/src/db-schema.ts`:
```typescript
export const TABLES = {
  IAM: { USERS: 'users', SESSIONS: 'sessions', ORGS: 'organizations' },
  APP: { DOMAINS: 'domains', TEMPLATES: 'templates', QUOTAS: 'user_quotas' }
} as const
```

---

### 5. Test Email Domains (35 files)

**Problem:** Many test files use `@test.com`, `@example.com` instead of enforced test domains.

**Fix:** Enforce `generateTestEmail()` from `lib/test-helpers/test-email-domains.ts`.

---

## Already Well Centralized (No Action Needed)

| Area | Location |
|------|----------|
| Cookie names | `COOKIE_NAMES` in `packages/shared/src/constants.ts` |
| Claude models | `packages/shared/src/models.ts` |
| MCP providers | `packages/shared/src/mcp-providers.ts` |
| Server IP | `packages/shared/src/config.ts` |
| Feature flags | `packages/shared/src/constants.ts` |
| Environment config | `packages/shared/environments.ts` |

## Priority Order

1. **Reserved slugs** - Security gap, fix immediately
2. **API responses** - Code quality, moderate effort
3. **Port generation** - Deployment safety
4. **DB schema constants** - Refactoring safety
5. **Test email enforcement** - Test reliability
