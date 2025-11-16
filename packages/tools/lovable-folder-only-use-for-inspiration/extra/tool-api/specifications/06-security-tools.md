# Security Tools

4 tools for scanning backend security, retrieving findings, analyzing database schema, and managing security issues.

---

## `security--run_security_scan`

Run comprehensive security audit on backend infrastructure.

**Signature:**
```typescript
security--run_security_scan(): void
```

**Parameters:** None

**Returns:** Scan started message (results retrieved separately)

**Usage:**
```typescript
// Start security scan
security--run_security_scan()

// Takes 30-60 seconds to complete
// Then retrieve results:
// security--get_security_scan_results(false)
```

**What Gets Scanned:**
- **Database tables:** Missing RLS policies, public access
- **RLS policies:** Incorrectly configured, bypassable, overly permissive
- **Auth flows:** Exposed user data, email enumeration, weak password policies
- **Input validation:** SQL injection risks, XSS vulnerabilities
- **Storage buckets:** Public access, missing policies
- **Edge functions:** Secrets in code, missing CORS, improper error handling
- **API endpoints:** Unauthorized access, missing authentication

**Scan Duration:**
- Small projects: 30-45 seconds
- Large projects: 45-60 seconds

**Critical Rules:**
- ⚠️ Takes 30-60 seconds to complete (async operation)
- ✅ Run when user requests security audit
- ✅ Run after implementing auth/database features
- ✅ Results retrieved with separate tool
- ✅ Scan doesn't affect app performance

**When to Run:**
- User asks for security audit
- After implementing authentication
- After creating database tables
- Before production deployment
- Periodic security checks

---

## `security--get_security_scan_results`

Retrieve findings from security scan.

**Signature:**
```typescript
security--get_security_scan_results(force: boolean): SecurityFindings
```

**Parameters:**
- `force` (required): Whether to return results even if scan still running
  - `false`: Wait for scan completion (recommended)
  - `true`: Return partial results if scan in progress

**Returns:** Structured security findings with severity levels

**Usage:**
```typescript
// Get results after scan completes
security--get_security_scan_results(false)

// Force results even if scan running (not recommended)
security--get_security_scan_results(true)
```

**Output Format:**
```json
{
  "findings": [
    {
      "id": "EXPOSED_TABLE",
      "internal_id": "users_table_no_rls",
      "name": "Users table exposed without RLS",
      "description": "The users table can be accessed by anyone. Enable RLS to secure user data.",
      "level": "error",
      "category": "Missing RLS",
      "details": "Table 'users' has RLS disabled. Any authenticated user can read/modify all user records.",
      "remediation_difficulty": "medium",
      "link": "https://docs.lovable.dev/features/security"
    },
    {
      "id": "WEAK_RLS_POLICY",
      "internal_id": "posts_policy_bypassable",
      "name": "Posts RLS policy can be bypassed",
      "description": "The posts SELECT policy doesn't verify ownership properly.",
      "level": "warn",
      "category": "Weak Policy",
      "details": "Policy checks user_id = auth.uid() but doesn't handle null user_id...",
      "remediation_difficulty": "low",
      "link": "https://docs.lovable.dev/features/security"
    }
  ],
  "summary": {
    "error": 3,
    "warn": 7,
    "info": 2
  }
}
```

**Severity Levels:**
- **error:** Critical security issues requiring immediate fix
- **warn:** Important issues that should be addressed
- **info:** Suggestions and best practices

**Critical Rules:**
- ✅ Wait for scan completion (`force: false`) for complete results
- ✅ Findings prioritized by severity
- ✅ Each finding includes remediation guidance
- ✅ Use findings to guide security improvements
- ⚠️ Don't ignore "warn" level findings

---

## `security--get_table_schema`

Get database schema and RLS analysis for security review.

**Signature:**
```typescript
security--get_table_schema(): string
```

**Parameters:** None

**Returns:** Complete database schema with RLS policy details

**Usage:**
```typescript
// Get database schema for analysis
security--get_table_schema()
```

**Output Includes:**
- All table definitions (columns, types, constraints)
- RLS status for each table (enabled/disabled)
- Existing RLS policies with SQL
- Foreign key relationships
- Indexes
- Functions and triggers
- Storage bucket configurations

**Use Cases:**
1. **Manual security review:** Analyze schema for vulnerabilities
2. **Before implementing features:** Understand data structure
3. **RLS policy planning:** See existing policies before adding new ones
4. **Debugging RLS issues:** Verify policies are correct

**Critical Rules:**
- ✅ Use before modifying RLS policies
- ✅ Use to understand data relationships
- ✅ Shows actual SQL for policies (not abstractions)
- ✅ Reveals tables without RLS enabled
- ✅ Helpful for complex multi-table security logic

---

## `security--manage_security_finding`

Create, update, or delete security findings.

**Signature:**
```typescript
security--manage_security_finding(operations: Operation[]): void
```

**Parameters:**
- `operations` (required): Array of operations to perform
  - Each operation has: `operation` ("create" | "update" | "delete"), `internal_id`, `scanner_name`, `finding`

**Returns:** Success message

**Usage:**

### Delete Solved Issue
```typescript
// After fixing a security issue, delete the finding
security--manage_security_finding({
  operations: [{
    operation: "delete",
    internal_id: "users_table_no_rls",
    scanner_name: "agent_security"
  }]
})
```

### Update Unsolvable Issue
```typescript
// When issue can't be fixed, document why with increased difficulty
security--manage_security_finding({
  operations: [{
    operation: "update",
    internal_id: "complex_auth_flow",
    scanner_name: "agent_security",
    finding: {
      remediation_difficulty: "high",
      details: "Cannot fix because the auth flow requires legacy API compatibility. Requires redesigning entire authentication system and migrating existing users.",
      description: "Complex authentication flow has security considerations requiring architectural changes"
    }
  }]
})
```

### Ignore Irrelevant Issue
```typescript
// When finding is not actually a security issue in context
security--manage_security_finding({
  operations: [{
    operation: "update",
    internal_id: "public_profiles_table",
    scanner_name: "agent_security",
    finding: {
      ignore: true,
      ignore_reason: "Public profiles are intentionally accessible to all users for the social features. This is acceptable because profiles only contain public information (username, bio, avatar) with no sensitive data."
    }
  }]
})
```

### Create New Finding
```typescript
// When discovering new security issue during analysis
security--manage_security_finding({
  operations: [{
    operation: "create",
    scanner_name: "agent_security",
    finding: {
      id: "EXPOSED_API_KEY",
      internal_id: "hardcoded_key_auth_ts",
      name: "API key hardcoded in source code",
      description: "Stripe API key found hardcoded in auth.ts file. Move to Supabase secrets to prevent exposure.",
      level: "error",
      category: "Exposed Secret",
      details: "Line 47 of src/auth.ts contains: const key = 'sk_test_...' This key is visible in version control and client-side builds. Use Deno.env.get('STRIPE_SECRET_KEY') in edge functions instead.",
      remediation_difficulty: "low",
      link: "https://docs.lovable.dev/features/security"
    }
  }]
})
```

### Batch Operations
```typescript
// Update multiple findings at once
security--manage_security_finding({
  operations: [
    {
      operation: "delete",
      internal_id: "fixed_rls_users"
    },
    {
      operation: "delete", 
      internal_id: "fixed_rls_posts"
    },
    {
      operation: "update",
      internal_id: "cannot_fix_legacy",
      finding: {
        remediation_difficulty: "high",
        details: "Requires legacy system migration..."
      }
    }
  ]
})
```

**Finding IDs (predefined types):**
- `EXPOSED_TABLE` - Table missing RLS
- `WEAK_RLS_POLICY` - RLS policy can be bypassed
- `MISSING_AUTH` - Endpoint missing authentication
- `EXPOSED_API_KEY` - Secret in source code
- `SQL_INJECTION` - SQL injection vulnerability
- `XSS_VULNERABILITY` - Cross-site scripting risk
- `INSECURE_STORAGE` - Storage bucket publicly accessible
- `EMAIL_ENUMERATION` - Auth flow reveals user existence
- `WEAK_PASSWORD` - Weak password policy
- `MISSING_INPUT_VALIDATION` - Unvalidated user input
- `OTHER` - Use sparingly for genuine issues not fitting categories

**Severity Levels:**
- `"error"` - Critical security issue
- `"warn"` - Important but not critical
- `"info"` - Best practice suggestion

**Remediation Difficulty:**
- `"low"` - Quick fix (< 1 hour)
- `"medium"` - Moderate effort (1-4 hours)
- `"high"` - Significant refactoring (> 4 hours)

**Critical Rules:**
- ✅ Delete findings after successfully fixing issues
- ✅ Update findings when issue can't be fixed (document why)
- ✅ Ignore findings that aren't actually security issues (with detailed reason)
- ✅ Create findings when discovering new issues
- ✅ Batch multiple operations for efficiency
- ❌ Don't leave stale findings after fixes
- ✅ Provide detailed explanations in `details` and `ignore_reason`

---

## Security Audit Workflow

### Complete Security Audit

```typescript
// 1. Start scan
security--run_security_scan()

// 2. Wait for completion (30-60 seconds)
project_debug--sleep(45)

// 3. Get results
const findings = security--get_security_scan_results(false)

// 4. Review and prioritize
// - Focus on "error" level first
// - Then "warn" level
// - "info" level when time permits

// 5. Fix issues one by one

// 6. Delete finding after each fix
security--manage_security_finding({
  operations: [{
    operation: "delete",
    internal_id: "finding_internal_id"
  }]
})

// 7. Re-scan to verify
security--run_security_scan()
```

### Investigating Specific Issue

```typescript
// 1. Get full schema context
security--get_table_schema()

// 2. Analyze RLS policies

// 3. Identify root cause

// 4. Fix the issue

// 5. Mark finding as resolved
security--manage_security_finding({
  operations: [{
    operation: "delete",
    internal_id: "fixed_issue_id"
  }]
})
```

### Documenting Accepted Risk

```typescript
// For issues that can't be fixed:

// 1. Update finding with high difficulty
security--manage_security_finding({
  operations: [{
    operation: "update",
    internal_id: "complex_issue",
    finding: {
      remediation_difficulty: "high",
      details: "Cannot fix because [specific technical reason]. Requires [specific changes]. Accepted risk because [business justification]."
    }
  }]
})

// Or ignore if not actually an issue:
security--manage_security_finding({
  operations: [{
    operation: "update",
    internal_id: "false_positive",
    finding: {
      ignore: true,
      ignore_reason: "This is intentional because [detailed context]. Not a security issue because [justification]."
    }
  }]
})
```

---

## Best Practices

**Run Scans Regularly:**
- After implementing new features
- Before production deployment
- Weekly for active projects
- After any auth/database changes

**Prioritize Fixes:**
1. **error** level issues - fix immediately
2. **warn** level issues - fix soon
3. **info** level suggestions - fix when possible

**Document Decisions:**
- Update findings with detailed reasons if can't fix
- Mark false positives as ignored with clear explanation
- Keep audit trail of security decisions

**Don't Ignore Warnings:**
- "warn" level issues can become critical
- Address systematically over time
- Understand why each warning exists

**Verify Fixes:**
- Delete finding after fixing
- Re-run scan to confirm fix worked
- Check for related issues that may have same root cause
