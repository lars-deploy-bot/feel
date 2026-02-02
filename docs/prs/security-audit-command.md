# RFC: Security Audit System

**Status:** Draft
**RFC ID:** RFC-2026-009
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

Automated security audit that checks workspace configuration, permissions, authentication, and common vulnerabilities. Users get a clear report with severity levels and actionable fixes. Like `openclaw doctor` but for website security.

## Problem

Users can misconfigure their site without knowing. Security issues accumulate silently:
- Exposed API keys in code
- Overly permissive file permissions
- Missing authentication on admin routes
- Outdated dependencies with vulnerabilities
- Debug mode left enabled in production

They only find out when something bad happens.

**User need:** "Is my site secure? What should I fix?"

## What We Audit

| Category | Checks | Severity |
|----------|--------|----------|
| **Secrets** | API keys in code, .env in git, exposed credentials | Critical |
| **Dependencies** | Known vulnerabilities, outdated packages | Critical/Warn |
| **Configuration** | Debug mode, permissive CORS, missing CSP | Warning |
| **Authentication** | Weak passwords, missing auth on routes | Critical |
| **Files** | Permission issues, world-readable secrets | Critical |
| **SSL/TLS** | Certificate validity, HTTPS enforcement | Warning |
| **Headers** | Security headers present and configured | Info |

## Audit Report Format

```typescript
interface SecurityAuditReport {
  timestamp: Date
  siteId: string
  summary: {
    critical: number
    warning: number
    info: number
    passed: number
  }
  findings: SecurityFinding[]
  score: number  // 0-100
}

interface SecurityFinding {
  id: string
  checkId: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string  // User-friendly explanation
  technicalDetails?: string  // For advanced users
  location?: string  // File path, line number, etc.
  remediation: string  // How to fix
  autoFixAvailable: boolean
  fixAction?: string  // ID of auto-fix action
}
```

## Example Report

```
┌─────────────────────────────────────────────────┐
│ 🔒 Security Audit Results                       │
│    sweetmorning.com                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ Score: 72/100                                   │
│ ██████████████░░░░░░ 72%                        │
│                                                 │
│ 🔴 Critical: 1                                  │
│ 🟡 Warning: 3                                   │
│ 🔵 Info: 2                                      │
│ ✅ Passed: 12                                   │
│                                                 │
├─────────────────────────────────────────────────┤
│ 🔴 CRITICAL                                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ API Key Exposed in Code                         │
│ Found what looks like an API key in your code.  │
│                                                 │
│ File: src/lib/api.ts, line 15                   │
│ const API_KEY = "sk_live_abc123..."             │
│                                                 │
│ Why it matters:                                 │
│ Anyone who views your code can steal this key   │
│ and make API calls on your behalf.              │
│                                                 │
│ How to fix:                                     │
│ Move this to an environment variable.           │
│                                                 │
│ [Fix It For Me] [Show Me How]                   │
│                                                 │
├─────────────────────────────────────────────────┤
│ 🟡 WARNING                                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ 3 Packages Have Known Vulnerabilities           │
│ Some of your dependencies have security issues. │
│                                                 │
│ • lodash (4.17.20) - Prototype pollution        │
│ • axios (0.21.0) - SSRF vulnerability           │
│ • minimist (1.2.5) - Prototype pollution        │
│                                                 │
│ [Update All] [View Details]                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Security Checks

### 1. Secrets Detection

```typescript
const SECRET_PATTERNS = [
  // API Keys
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe Live Key' },
  { pattern: /sk_test_[a-zA-Z0-9]{24,}/, name: 'Stripe Test Key' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Token' },
  { pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/, name: 'Slack Token' },

  // Generic patterns
  { pattern: /["']?api[_-]?key["']?\s*[=:]\s*["'][a-zA-Z0-9]{20,}["']/, name: 'Generic API Key' },
  { pattern: /["']?secret["']?\s*[=:]\s*["'][a-zA-Z0-9]{20,}["']/, name: 'Generic Secret' },
  { pattern: /["']?password["']?\s*[=:]\s*["'][^"']{8,}["']/, name: 'Hardcoded Password' },
]

async function checkForSecrets(siteId: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = []
  const files = await getSourceFiles(siteId)

  for (const file of files) {
    // Skip node_modules, .env files (expected to have secrets)
    if (file.path.includes('node_modules') || file.path.endsWith('.env')) {
      continue
    }

    for (const { pattern, name } of SECRET_PATTERNS) {
      const matches = file.content.match(pattern)
      if (matches) {
        findings.push({
          id: `secret_${file.path}_${pattern.source}`,
          checkId: 'secrets.exposed',
          severity: 'critical',
          title: `${name} Exposed in Code`,
          description: `Found what looks like a ${name} hardcoded in your source files.`,
          location: file.path,
          remediation: 'Move this value to an environment variable and reference it as process.env.YOUR_VAR',
          autoFixAvailable: true,
        })
      }
    }
  }

  return findings
}
```

### 2. Dependency Vulnerabilities

```typescript
async function checkDependencies(siteId: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = []

  // Run npm audit or similar
  const auditResult = await runSecurityAudit(siteId)

  for (const vuln of auditResult.vulnerabilities) {
    findings.push({
      id: `dep_${vuln.package}_${vuln.id}`,
      checkId: 'dependencies.vulnerable',
      severity: vuln.severity === 'critical' ? 'critical' : 'warning',
      title: `${vuln.package} has a known vulnerability`,
      description: vuln.title,
      technicalDetails: `${vuln.cwe}\n${vuln.url}`,
      remediation: `Update to ${vuln.package}@${vuln.patchedVersion} or later`,
      autoFixAvailable: true,
    })
  }

  return findings
}
```

### 3. Configuration Checks

```typescript
async function checkConfiguration(siteId: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = []
  const config = await getSiteConfig(siteId)

  // Debug mode
  if (config.debug === true || process.env.NODE_ENV === 'development') {
    findings.push({
      id: 'config_debug_mode',
      checkId: 'config.debug',
      severity: 'warning',
      title: 'Debug Mode Enabled',
      description: 'Your site is running in debug mode, which may expose sensitive information.',
      remediation: 'Set NODE_ENV=production for your live site',
      autoFixAvailable: true,
    })
  }

  // Missing security headers
  const headers = await checkSecurityHeaders(siteId)
  if (!headers.contentSecurityPolicy) {
    findings.push({
      id: 'config_no_csp',
      checkId: 'headers.csp',
      severity: 'info',
      title: 'No Content Security Policy',
      description: 'Adding a CSP header helps prevent XSS attacks.',
      remediation: 'Add Content-Security-Policy header to your responses',
      autoFixAvailable: false,
    })
  }

  return findings
}
```

### 4. Authentication Checks

```typescript
async function checkAuthentication(siteId: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = []

  // Check for admin/api routes without auth
  const routes = await analyzeRoutes(siteId)

  for (const route of routes) {
    if (route.path.includes('/admin') || route.path.includes('/api')) {
      if (!route.hasAuthMiddleware) {
        findings.push({
          id: `auth_unprotected_${route.path}`,
          checkId: 'auth.unprotected_route',
          severity: 'critical',
          title: `Unprotected Route: ${route.path}`,
          description: 'This route appears to be an admin or API route but has no authentication.',
          remediation: 'Add authentication middleware to protect this route',
          autoFixAvailable: false,
        })
      }
    }
  }

  return findings
}
```

## API Endpoint

```typescript
// POST /api/security/audit
export async function POST(req: Request) {
  const { siteId } = await req.json()
  const userId = await getAuthenticatedUser(req)

  // Verify user owns site
  await verifySiteOwnership(userId, siteId)

  // Run all checks
  const findings = await Promise.all([
    checkForSecrets(siteId),
    checkDependencies(siteId),
    checkConfiguration(siteId),
    checkAuthentication(siteId),
    checkFilePermissions(siteId),
    checkSSL(siteId),
    checkSecurityHeaders(siteId),
  ])

  const allFindings = findings.flat()

  const report: SecurityAuditReport = {
    timestamp: new Date(),
    siteId,
    summary: {
      critical: allFindings.filter(f => f.severity === 'critical').length,
      warning: allFindings.filter(f => f.severity === 'warning').length,
      info: allFindings.filter(f => f.severity === 'info').length,
      passed: TOTAL_CHECKS - allFindings.length,
    },
    findings: allFindings,
    score: calculateScore(allFindings),
  }

  // Store for history
  await storeAuditReport(report)

  return Response.json(report)
}
```

## Auto-Fix Actions

```typescript
// POST /api/security/fix
export async function POST(req: Request) {
  const { siteId, findingId, fixAction } = await req.json()

  const handlers: Record<string, FixHandler> = {
    'move_secret_to_env': async (finding) => {
      // Extract the secret value
      // Add to .env file
      // Replace in source with process.env.VAR_NAME
      // Return diff of changes
    },
    'update_package': async (finding) => {
      // Run npm update for the specific package
      // Return new version installed
    },
    'set_production_mode': async (finding) => {
      // Update configuration
      // Return changes made
    },
  }

  const handler = handlers[fixAction]
  if (!handler) {
    return Response.json({ error: 'Unknown fix action' }, { status: 400 })
  }

  const result = await handler(finding)
  return Response.json(result)
}
```

## Database Schema

```sql
-- Audit reports
CREATE TABLE security_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES domains(id) NOT NULL,
  triggered_by TEXT NOT NULL,  -- 'user', 'scheduled', 'deploy'

  score INT,
  critical_count INT,
  warning_count INT,
  info_count INT,
  passed_count INT,

  findings JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_audits_site ON security_audits(site_id);
CREATE INDEX idx_security_audits_time ON security_audits(created_at);

-- Track fixes applied
CREATE TABLE security_fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES security_audits(id),
  finding_id TEXT NOT NULL,
  fix_action TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'failed'
  changes_made JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Scheduled Audits

Run audits automatically:

```typescript
// Run weekly for all active sites
async function runScheduledAudits() {
  const activeSites = await getActiveSites()

  for (const site of activeSites) {
    const report = await runSecurityAudit(site.id)

    // Notify if critical issues found
    if (report.summary.critical > 0) {
      await sendSecurityAlert(site.userId, report)
    }
  }
}
```

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Secrets detection | 2 days |
| Phase 2 | Dependency vulnerability check | 1 day |
| Phase 3 | Configuration checks | 1-2 days |
| Phase 4 | Audit UI + report display | 2 days |
| Phase 5 | Auto-fix for common issues | 2-3 days |
| Phase 6 | Scheduled audits + alerts | 1-2 days |
| Total | Full security audit | ~2 weeks |

## Success Metrics

- % of sites with at least one audit run
- Critical issues found and fixed
- Time from detection to fix
- Security score improvements over time

## References

- [OpenClaw security/audit.ts](https://github.com/openclaw/openclaw) - 986 lines of security checks
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Snyk](https://snyk.io/) - Security scanning patterns
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
