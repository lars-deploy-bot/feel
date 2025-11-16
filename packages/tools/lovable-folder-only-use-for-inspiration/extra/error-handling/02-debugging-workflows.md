# Debugging Workflows

## Systematic Approaches to Diagnosing Issues

This document covers step-by-step debugging workflows for common problem categories in Lovable projects.

---

## Debugging Tools Available

```
lov-read-console-logs(search?)        → Browser console output
lov-read-network-requests(search?)    → API calls and responses
project_debug--sandbox-screenshot(path) → Visual state capture
lov-search-files(query, pattern)      → Code search
lov-view(file_path, lines?)           → File inspection
```

---

## Workflow 1: "It's Not Working" (Generic Error)

### Step-by-Step Process

```
User: "It's not working"
         │
         ▼
┌─────────────────────────────────────────┐
│ Step 1: Check console for errors       │
│ Tool: lov-read-console-logs("error")    │
└────────┬────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
  Errors     No errors
  found      found
    │         │
    ▼         ▼
 Go to     ┌──────────────────────────────┐
 Step 3    │ Step 2: Check network        │
           │ Tool: lov-read-network-       │
           │       requests("error")       │
           └────────┬─────────────────────┘
                    │
               ┌────┴────┐
               │         │
            Errors    No errors
            found     found
               │         │
               ▼         ▼
            Go to     ┌──────────────────┐
            Step 3    │ Step 2b: Take    │
                      │ screenshot       │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ Step 2c: Ask for │
                      │ clarification    │
                      └──────────────────┘
```

### Implementation

```typescript
async function debugGenericIssue(userMessage: string): Promise<DiagnosisResult> {
  // Step 1: Check console logs
  const consoleLogs = await lov-read-console-logs("error");
  
  if (consoleLogs.logs.length > 0) {
    // Found errors - analyze them
    return await analyzeConsoleErrors(consoleLogs);
  }
  
  // Step 2: Check network requests
  const networkRequests = await lov-read-network-requests("error");
  
  if (networkRequests.requests.some(r => r.status >= 400)) {
    // Found failed requests - analyze them
    return await analyzeNetworkErrors(networkRequests);
  }
  
  // Step 2b: Take screenshot for visual issues
  const screenshot = await project_debug--sandbox-screenshot("/");
  
  // Step 2c: Ask for clarification
  return {
    type: 'needs_clarification',
    message: `I checked the console and network logs but didn't find obvious errors. Can you describe what's not working? For example:
• What were you trying to do?
• What did you expect to happen?
• What actually happened?

Screenshot of current state: ${screenshot.path}`,
    screenshot: screenshot.path
  };
}
```

---

## Workflow 2: Frontend Not Rendering

### Diagnosis Flow

```
Issue: Component not showing
         │
         ▼
┌─────────────────────────────────────────┐
│ Check 1: Is component imported?         │
│ Tool: lov-view(parent-component)        │
└────────┬────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
  Missing   Imported
  import    correctly
    │         │
    ▼         ▼
  Fix     ┌──────────────────────────────┐
  import  │ Check 2: Is component used?  │
          │ Search for <ComponentName>   │
          └────────┬─────────────────────┘
                   │
              ┌────┴────┐
              │         │
            Not used   Used
              │         │
              ▼         ▼
            Add to   ┌──────────────────┐
            JSX      │ Check 3: Styles  │
                     │ hiding it?       │
                     └────────┬─────────┘
                              │
                         ┌────┴────┐
                         │         │
                      Hidden    Visible
                         │         │
                         ▼         ▼
                       Fix      Check
                      styles    console
                                for
                                errors
```

### Implementation

```typescript
async function debugComponentNotRendering(
  componentName: string,
  parentFile: string
): Promise<FixAction[]> {
  
  const fixes: FixAction[] = [];
  
  // Check 1: Is component imported?
  const parentContent = await lov-view(parentFile);
  const importRegex = new RegExp(`import.*${componentName}.*from`, 'i');
  
  if (!importRegex.test(parentContent)) {
    fixes.push({
      type: 'add_import',
      message: `${componentName} is not imported in ${parentFile}`,
      fix: async () => {
        const componentPath = await findComponentFile(componentName);
        await addImportStatement(parentFile, componentName, componentPath);
      }
    });
  }
  
  // Check 2: Is component used in JSX?
  const jsxRegex = new RegExp(`<${componentName}[\\s/>]`, 'i');
  
  if (!jsxRegex.test(parentContent)) {
    fixes.push({
      type: 'add_to_jsx',
      message: `${componentName} is imported but not used in JSX`,
      fix: async () => {
        await addComponentToJSX(parentFile, componentName);
      }
    });
  }
  
  // Check 3: Console errors
  const consoleLogs = await lov-read-console-logs(componentName);
  
  if (consoleLogs.logs.length > 0) {
    fixes.push({
      type: 'fix_console_errors',
      message: `Found ${consoleLogs.logs.length} errors related to ${componentName}`,
      errors: consoleLogs.logs,
      fix: async () => {
        await analyzeAndFixErrors(consoleLogs.logs);
      }
    });
  }
  
  // Check 4: CSS hiding component?
  const styles = await analyzeComponentStyles(componentName);
  
  if (styles.hidden) {
    fixes.push({
      type: 'fix_styles',
      message: `${componentName} may be hidden by CSS`,
      issues: styles.issues,
      fix: async () => {
        await fixHiddenStyles(componentName, styles.issues);
      }
    });
  }
  
  return fixes;
}
```

---

## Workflow 3: API Call Failing

### Diagnosis Flow

```
Issue: API call returns error
         │
         ▼
┌─────────────────────────────────────────┐
│ Check 1: Network request details       │
│ Tool: lov-read-network-requests(url)    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Analyze response:                       │
│ • Status code                           │
│ • Error message                         │
│ • Request headers                       │
│ • Request body                          │
└────────┬────────────────────────────────┘
         │
    ┌────┴────────┐
    │             │
  4xx error    5xx error
    │             │
    ▼             ▼
┌─────────┐  ┌──────────┐
│ Client  │  │ Server   │
│ error   │  │ error    │
└────┬────┘  └────┬─────┘
     │            │
     ▼            ▼
  401/403     500/503
  Auth issue  Backend issue
     │            │
     ▼            ▼
  Check       Check edge
  secrets     function logs
```

### Implementation

```typescript
async function debugAPICallFailing(apiUrl: string): Promise<DiagnosisResult> {
  // Step 1: Get network request details
  const networkRequests = await lov-read-network-requests(apiUrl);
  const failedRequest = networkRequests.requests.find(r => 
    r.url.includes(apiUrl) && r.status >= 400
  );
  
  if (!failedRequest) {
    return {
      type: 'not_found',
      message: `No failed requests found for ${apiUrl}`
    };
  }
  
  // Step 2: Analyze based on status code
  if (failedRequest.status === 401) {
    return {
      type: 'auth_error',
      message: 'Authentication failed (401 Unauthorized)',
      diagnosis: 'Missing or invalid authentication token/API key',
      fixes: [
        'Check if VITE_SUPABASE_PUBLISHABLE_KEY is set',
        'Verify user is logged in (for authenticated endpoints)',
        'Check if API key secret is correctly configured'
      ]
    };
  }
  
  if (failedRequest.status === 403) {
    return {
      type: 'permission_error',
      message: 'Permission denied (403 Forbidden)',
      diagnosis: 'User lacks permission to access this resource',
      fixes: [
        'Check RLS policies on database table',
        'Verify user role has correct permissions',
        'Check if resource belongs to current user'
      ]
    };
  }
  
  if (failedRequest.status === 404) {
    return {
      type: 'not_found_error',
      message: 'Resource not found (404)',
      diagnosis: 'Endpoint or resource does not exist',
      fixes: [
        'Verify URL is correct',
        'Check if edge function is deployed',
        'Confirm resource ID is valid'
      ]
    };
  }
  
  if (failedRequest.status === 429) {
    return {
      type: 'rate_limit_error',
      message: 'Rate limit exceeded (429)',
      diagnosis: 'Too many requests in short time',
      fixes: [
        'Add delay between requests',
        'Implement request throttling',
        'Check if infinite loop is calling API'
      ]
    };
  }
  
  if (failedRequest.status >= 500) {
    return {
      type: 'server_error',
      message: `Server error (${failedRequest.status})`,
      diagnosis: 'Backend/edge function error',
      fixes: [
        'Check edge function logs for errors',
        'Verify edge function code is correct',
        'Check if Supabase service is down'
      ]
    };
  }
  
  // Unknown error
  return {
    type: 'unknown_error',
    message: `Request failed with status ${failedRequest.status}`,
    response: failedRequest.response,
    diagnosis: 'See response body for details'
  };
}
```

---

## Workflow 4: Performance Issue

### Diagnosis Flow

```
Issue: App is slow
         │
         ▼
┌─────────────────────────────────────────┐
│ Check 1: Identify bottleneck type      │
└────────┬────────────────────────────────┘
         │
    ┌────┴────────────┐
    │                 │
  Render            Network
  performance       slowness
    │                 │
    ▼                 ▼
┌────────────┐  ┌──────────────┐
│ Check for: │  │ Check for:   │
│ • Re-      │  │ • Large      │
│   renders  │  │   payloads   │
│ • Large    │  │ • Slow       │
│   lists    │  │   queries    │
│ • Heavy    │  │ • N+1        │
│   computat.│  │   queries    │
└────┬───────┘  └──────┬───────┘
     │                 │
     └────────┬────────┘
              ▼
       ┌──────────────┐
       │ Propose      │
       │ optimizations│
       └──────────────┘
```

### Implementation

```typescript
async function debugPerformanceIssue(): Promise<DiagnosisResult> {
  // Check console for performance warnings
  const consoleLogs = await lov-read-console-logs("slow");
  
  // Check network for slow requests
  const networkRequests = await lov-read-network-requests();
  const slowRequests = networkRequests.requests.filter(r => r.duration > 1000);
  
  const issues: PerformanceIssue[] = [];
  
  // Analyze render performance
  if (consoleLogs.logs.some(log => log.message.includes('re-render'))) {
    issues.push({
      type: 'excessive_rerenders',
      severity: 'high',
      message: 'Component is re-rendering excessively',
      fixes: [
        'Use React.memo() to prevent unnecessary re-renders',
        'Use useMemo() for expensive computations',
        'Use useCallback() for stable function references'
      ]
    });
  }
  
  // Analyze network performance
  if (slowRequests.length > 0) {
    issues.push({
      type: 'slow_network_requests',
      severity: 'high',
      message: `Found ${slowRequests.length} slow requests (>1s)`,
      slowRequests: slowRequests.map(r => ({
        url: r.url,
        duration: r.duration,
        size: r.responseSize
      })),
      fixes: [
        'Add loading states to improve perceived performance',
        'Implement pagination for large datasets',
        'Add caching with React Query',
        'Optimize database queries',
        'Add database indexes for frequently queried fields'
      ]
    });
  }
  
  // Check for large bundle size
  const bundleSize = await estimateBundleSize();
  if (bundleSize > 1024 * 1024) { // > 1MB
    issues.push({
      type: 'large_bundle',
      severity: 'medium',
      message: `Bundle size is ${(bundleSize / 1024 / 1024).toFixed(2)}MB`,
      fixes: [
        'Implement code splitting with React.lazy()',
        'Remove unused dependencies',
        'Use dynamic imports for heavy libraries'
      ]
    });
  }
  
  return {
    type: 'performance_issues',
    issues,
    summary: `Found ${issues.length} performance issues to address`
  };
}
```

---

## Workflow 5: Database Issue

### Diagnosis Flow

```
Issue: Database query failing
         │
         ▼
┌─────────────────────────────────────────┐
│ Check 1: RLS policy                     │
│ • Are policies defined?                 │
│ • Do they allow this operation?         │
└────────┬────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
  Policy    Policy
  missing   exists
    │         │
    ▼         ▼
  Create   ┌──────────────────────────────┐
  policy   │ Check 2: Authentication      │
           │ • Is user logged in?         │
           │ • Is user_id correct?        │
           └────────┬─────────────────────┘
                    │
               ┌────┴────┐
               │         │
            Not       Logged in
            logged    │
               │      │
               ▼      ▼
            Require ┌──────────────────┐
            login   │ Check 3: Schema  │
                    │ • Table exists?  │
                    │ • Columns match? │
                    └────────┬─────────┘
                             │
                        ┌────┴────┐
                        │         │
                      Valid    Invalid
                        │         │
                        ▼         ▼
                    Check     Fix
                    query     schema
```

### Implementation

```typescript
async function debugDatabaseIssue(
  tableName: string,
  operation: 'select' | 'insert' | 'update' | 'delete'
): Promise<DiagnosisResult> {
  
  // Check 1: Get table schema
  const schema = await security--get_table_schema();
  const table = schema.tables.find(t => t.name === tableName);
  
  if (!table) {
    return {
      type: 'table_not_found',
      message: `Table "${tableName}" does not exist`,
      fixes: ['Create table in Supabase SQL Editor']
    };
  }
  
  // Check 2: RLS policies
  const policies = table.policies;
  const relevantPolicy = policies.find(p => p.command === operation.toUpperCase());
  
  if (!relevantPolicy) {
    return {
      type: 'missing_rls_policy',
      message: `No RLS policy for ${operation} on ${tableName}`,
      fixes: [
        `Create ${operation.toUpperCase()} policy:`,
        ``,
        `CREATE POLICY "${operation}_${tableName}" ON ${tableName}`,
        `FOR ${operation.toUpperCase()}`,
        `USING (auth.uid() = user_id);`
      ]
    };
  }
  
  // Check 3: Authentication
  const networkRequests = await lov-read-network-requests(tableName);
  const dbRequest = networkRequests.requests.find(r => 
    r.url.includes(tableName) && r.status >= 400
  );
  
  if (dbRequest?.status === 401) {
    return {
      type: 'auth_required',
      message: 'User must be logged in to access this table',
      fixes: [
        'Wrap component in <AuthGuard>',
        'Check if useAuth() returns valid user',
        'Verify Supabase client is initialized'
      ]
    };
  }
  
  // Check 4: Column mismatch
  if (dbRequest?.response?.includes('column')) {
    return {
      type: 'column_mismatch',
      message: 'Query references non-existent column',
      diagnosis: dbRequest.response,
      fixes: [
        'Check column names match table schema',
        'Verify spelling and case sensitivity'
      ]
    };
  }
  
  return {
    type: 'unknown_database_error',
    message: 'Database query failed',
    response: dbRequest?.response || 'No error details available'
  };
}
```

---

## Debugging Checklist

When user reports an issue:

- [ ] **Read console logs** - Look for errors, warnings
- [ ] **Check network requests** - Identify failed API calls
- [ ] **Take screenshot** - See visual state
- [ ] **Search codebase** - Find relevant files
- [ ] **Inspect specific files** - Look for bugs
- [ ] **Test hypothesis** - Verify fix before implementing
- [ ] **Apply fix** - Make minimal changes
- [ ] **Verify fix** - Re-check logs and network

---

## Common Debugging Patterns

### Pattern: Binary Search

When error location is unknown:

```typescript
async function binarySearchForError(
  files: string[],
  testFunction: () => Promise<boolean>
): Promise<string> {
  
  if (files.length === 1) {
    return files[0]; // Found problematic file
  }
  
  const mid = Math.floor(files.length / 2);
  const firstHalf = files.slice(0, mid);
  const secondHalf = files.slice(mid);
  
  // Comment out first half, test
  await commentOutFiles(firstHalf);
  const errorStillOccurs = await testFunction();
  await uncommentFiles(firstHalf);
  
  if (errorStillOccurs) {
    // Error is in second half
    return await binarySearchForError(secondHalf, testFunction);
  } else {
    // Error is in first half
    return await binarySearchForError(firstHalf, testFunction);
  }
}
```

---

## Summary

**Debugging workflow:**
1. **Gather data** (logs, network, screenshots)
2. **Form hypothesis** (what might be wrong?)
3. **Test hypothesis** (does evidence support it?)
4. **Apply fix** (make targeted change)
5. **Verify fix** (check if issue resolved)

**Key tools:**
- Console logs → Frontend errors
- Network requests → API/backend errors
- Screenshots → Visual issues
- Code search → Find relevant files
- File inspection → Detailed code review

**Remember:** Good debugging is systematic, not random. Follow the data.
