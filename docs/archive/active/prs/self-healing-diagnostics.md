# RFC: Self-Healing Diagnostics

**Status:** Draft
**RFC ID:** RFC-2026-006
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

When something breaks, we automatically diagnose the problem and offer to fix it. Users shouldn't need to understand error messages or debug their site. One click to fix common issues.

## Problem

Users get stuck when something breaks. They see cryptic error messages. They don't know if it's their fault or ours. They abandon their site or contact support for issues that could be auto-fixed.

**User frustration:** "My site just shows a blank page. I have no idea what I did wrong or how to fix it."

## User Stories

1. **Build error:** User's site won't build → We show exactly what's wrong and offer "Fix it for me"
2. **Broken after edit:** User edited something and broke it → We detect, explain, offer to revert
3. **Dependency issue:** Package conflict → We explain in plain English and offer resolution
4. **Configuration error:** Wrong settings → We highlight the problem and suggest fix
5. **"Why is my site slow?"** → We diagnose and show top issues with fix buttons

## What We Diagnose

| Category | Issues Detected | Auto-Fix Available |
|----------|-----------------|-------------------|
| **Build** | TypeScript errors, missing imports, syntax errors | Sometimes (simple fixes) |
| **Runtime** | Server crashes, infinite loops, memory issues | Restart + suggest fix |
| **Content** | Missing images, broken links, 404 pages | Link to fix or remove |
| **Config** | Invalid settings, missing env vars | Suggest correct values |
| **Performance** | Large images, slow queries, bundle size | Optimize images, suggest fixes |
| **Dependencies** | Version conflicts, missing packages | Reinstall, update |

## Technical Approach

### Diagnostic Engine

```typescript
interface DiagnosticResult {
  status: 'healthy' | 'warning' | 'error'
  checks: DiagnosticCheck[]
  summary: string  // Plain English summary
}

interface DiagnosticCheck {
  id: string
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string  // User-friendly explanation
  technicalDetails?: string  // For advanced users
  autoFixAvailable: boolean
  fixAction?: () => Promise<FixResult>
}

async function runDiagnostics(siteId: string): Promise<DiagnosticResult> {
  const checks = await Promise.all([
    checkBuildHealth(siteId),
    checkRuntimeHealth(siteId),
    checkDependencies(siteId),
    checkConfiguration(siteId),
    checkPerformance(siteId),
  ])

  return {
    status: deriveOverallStatus(checks),
    checks: checks.flat(),
    summary: generateSummary(checks)
  }
}
```

### Individual Checks

```typescript
// Build health check
async function checkBuildHealth(siteId: string): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = []

  // Run TypeScript compiler
  const tscResult = await runTypeCheck(siteId)
  if (tscResult.errors.length > 0) {
    checks.push({
      id: 'typescript-errors',
      name: 'TypeScript Errors',
      status: 'fail',
      message: `Found ${tscResult.errors.length} TypeScript error(s) preventing your site from building`,
      technicalDetails: tscResult.errors.map(e => e.message).join('\n'),
      autoFixAvailable: tscResult.errors.some(e => e.autoFixable),
      fixAction: async () => {
        // Ask Claude to fix the errors
        return await claudeFixErrors(siteId, tscResult.errors)
      }
    })
  }

  // Check for build output
  const buildExists = await checkBuildOutput(siteId)
  if (!buildExists) {
    checks.push({
      id: 'no-build-output',
      name: 'Missing Build',
      status: 'fail',
      message: 'Your site hasn\'t been built yet. This might be why it\'s not showing.',
      autoFixAvailable: true,
      fixAction: async () => {
        return await triggerBuild(siteId)
      }
    })
  }

  return checks
}

// Dependency check
async function checkDependencies(siteId: string): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = []

  const nodeModulesExists = await checkNodeModules(siteId)
  if (!nodeModulesExists) {
    checks.push({
      id: 'missing-node-modules',
      name: 'Missing Dependencies',
      status: 'fail',
      message: 'Your site is missing its dependencies (node_modules). This usually happens after a fresh setup.',
      autoFixAvailable: true,
      fixAction: async () => {
        return await installDependencies(siteId)
      }
    })
  }

  // Check for outdated/vulnerable packages
  const audit = await runSecurityAudit(siteId)
  if (audit.vulnerabilities > 0) {
    checks.push({
      id: 'security-vulnerabilities',
      name: 'Security Issues',
      status: 'warn',
      message: `Found ${audit.vulnerabilities} package(s) with known security issues`,
      autoFixAvailable: true,
      fixAction: async () => {
        return await updateVulnerablePackages(siteId)
      }
    })
  }

  return checks
}
```

### User-Facing Error Translation

```typescript
// Translate technical errors to plain English
function translateError(error: string): string {
  const translations: Record<string, string> = {
    'ENOENT': 'A file is missing that your site needs',
    'EACCES': 'Permission issue - we can\'t access a file',
    'Cannot find module': 'Your site is trying to use something that isn\'t installed',
    'SyntaxError': 'There\'s a typo in your code',
    'TypeError': 'Your code is trying to do something with the wrong type of data',
    'ReferenceError': 'Your code mentions something that doesn\'t exist',
    'SIGKILL': 'Your site ran out of memory or took too long',
    'ETIMEDOUT': 'Couldn\'t connect - might be a network issue',
  }

  for (const [pattern, translation] of Object.entries(translations)) {
    if (error.includes(pattern)) {
      return translation
    }
  }

  return 'Something unexpected went wrong'
}
```

## User Interface

### Site Health Dashboard

```
┌─────────────────────────────────────────────────┐
│ Site Health                                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔴 Your site has 2 issues                       │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ❌ TypeScript Error                         │ │
│ │                                             │ │
│ │ There's an error on line 42 of HomePage.   │ │
│ │ A variable is spelled wrong.               │ │
│ │                                             │ │
│ │ [Show Details]  [Fix It For Me]            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ⚠️ Large Images                             │ │
│ │                                             │ │
│ │ 3 images are very large and slowing down   │ │
│ │ your site. We can optimize them.           │ │
│ │                                             │ │
│ │ [Show Images]  [Optimize All]              │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ✅ Dependencies: OK                             │
│ ✅ Configuration: OK                            │
│ ✅ SSL Certificate: OK                          │
│                                                 │
│ [Run Full Diagnostic]                           │
└─────────────────────────────────────────────────┘
```

### Inline Error Experience

When user sees an error in chat:

```
┌─────────────────────────────────────────────────┐
│ ❌ Couldn't update your site                    │
│                                                 │
│ What happened:                                  │
│ There's a spelling mistake in your code.       │
│ You wrote "conts" instead of "const".          │
│                                                 │
│ File: src/pages/HomePage.tsx, line 42          │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 42 │ conts name = "Hello"                   │ │
│ │    │ ^^^^^ should be "const"                │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Fix This] [Show Full Error] [Ask for Help]    │
└─────────────────────────────────────────────────┘
```

### "Fix It" Flow

```typescript
async function handleFixRequest(checkId: string, siteId: string) {
  const check = await getCheck(checkId)

  // Show what we're going to do
  await showConfirmation({
    title: 'Fix: ' + check.name,
    message: `I'll ${check.fixDescription}. This should resolve the issue.`,
    actions: ['Proceed', 'Cancel']
  })

  // Execute fix
  const result = await check.fixAction()

  if (result.success) {
    await showSuccess({
      message: 'Fixed! Your site should work now.',
      action: 'View Site'
    })
  } else {
    await showError({
      message: 'Couldn\'t auto-fix this one.',
      suggestion: 'Try describing what you were doing and I\'ll help manually.',
    })
  }
}
```

## Database Schema

```sql
-- Diagnostic runs
CREATE TABLE diagnostic_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES domains(id) NOT NULL,
  triggered_by TEXT NOT NULL,  -- 'user', 'auto', 'error'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  overall_status TEXT,  -- 'healthy', 'warning', 'error'
  checks JSONB NOT NULL,  -- array of check results
  summary TEXT
);

-- Auto-fix history
CREATE TABLE autofix_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES domains(id) NOT NULL,
  diagnostic_run_id UUID REFERENCES diagnostic_runs(id),
  check_id TEXT NOT NULL,
  fix_type TEXT NOT NULL,
  fix_description TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'failure', 'partial'
  changes_made JSONB,  -- files changed, commands run
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Automatic Triggers

Run diagnostics automatically when:

1. **Build fails** → Diagnose immediately
2. **Site returns 5xx** → Check runtime health
3. **User reports problem** → Run full diagnostic
4. **After deployment** → Quick health check
5. **Weekly** → Background full scan

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Build error diagnosis + translation | 2-3 days |
| Phase 2 | Auto-fix for common issues | 3-4 days |
| Phase 3 | Health dashboard UI | 2-3 days |
| Phase 4 | Performance diagnostics | 2-3 days |
| Phase 5 | Proactive/scheduled diagnostics | 2 days |
| Total | Full diagnostic system | ~2 weeks |

## Success Metrics

- % of errors auto-diagnosed correctly
- % of auto-fixes that resolve the issue
- Time from error to resolution
- Support tickets avoided
- User satisfaction with error experience

## Open Questions

1. How aggressive should auto-fix be? (ask first vs just fix)
2. Should we keep history of all diagnostics?
3. How to handle issues we can diagnose but can't fix?
4. Integration with chat - should Claude proactively diagnose?

## References

- [OpenClaw Doctor Command](https://docs.openclaw.ai/gateway/doctor)
- OpenClaw's `src/infra/unhandled-rejections.ts` - error classification
- [Sentry](https://sentry.io/) - error tracking patterns
- [Vercel](https://vercel.com/) - deployment error UX
