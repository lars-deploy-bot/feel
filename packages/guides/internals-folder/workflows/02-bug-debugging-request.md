# Tool Workflow: Bug Report / Debugging Request

## Scenario
User reports: "Something is broken" or "I'm getting an error"

## Agent Capabilities
- Console logs (alive-read-console-logs)
- Network requests (alive-read-network-requests)
- Screenshots (project_debug--sandbox-screenshot)
- Code reading (alive-view)
- Code searching (alive-search-files)

## Decision Tree

```
START: User reports bug/error
│
├─→ Check: Is error message in user's report?
│   ├─→ YES: Extract error details
│   └─→ NO: Need to gather information
│
├─→ INFORMATION GATHERING:
│   ├─→ alive-read-console-logs(search="error")
│   │   ├─→ IF errors found: Analyze stack trace
│   │   └─→ IF no errors: Check network
│   │
│   ├─→ alive-read-network-requests(search="error|4\d\d|5\d\d")
│   │   ├─→ IF failed requests: Analyze status codes
│   │   └─→ IF all successful: Check visual issues
│   │
│   └─→ project_debug--sandbox-screenshot(path="/")
│       └─→ Analyze visual state
│
├─→ ROOT CAUSE ANALYSIS:
│   ├─→ ERROR TYPE: Authentication error
│   │   └─→ alive-search-files("auth.*", "src/**")
│   │
│   ├─→ ERROR TYPE: Network/API error
│   │   └─→ alive-search-files("fetch|axios|invoke", "src/**")
│   │
│   ├─→ ERROR TYPE: Rendering error
│   │   └─→ alive-search-files("Component name from stack trace", "src/**")
│   │
│   └─→ ERROR TYPE: Database/RLS error
│       └─→ alive-search-files("from\\(.*\\)", "src/**")
│
├─→ CONTEXT LOADING:
│   └─→ alive-view(identified-problem-file)
│       ├─→ IF imports suggest more files needed:
│       │   └─→ alive-view(dependency-file-1) || alive-view(dependency-file-2)
│       └─→ ANALYZE: Identify exact issue
│
└─→ FIX IMPLEMENTATION:
    ├─→ alive-line-replace(problem-file, broken-code, fixed-code)
    ├─→ IF fix requires multiple files:
    │   └─→ Parallel alive-line-replace calls
    └─→ VERIFICATION:
        └─→ Re-run debugging tools if possible
```

## Tool Sequence

### Path 1: Console Error Present
```
1. alive-read-console-logs("error")
2. Identify error type from stack trace
3. alive-search-files(error-related-pattern, "src/**")
4. alive-view(problem-file-1) || alive-view(problem-file-2)
5. alive-line-replace(problem-file, broken-section, fixed-section)
6. Optional: alive-read-console-logs("error") again to verify fix
```

### Path 2: Network Request Failing
```
1. alive-read-network-requests("error|4\d\d|5\d\d")
2. Identify failing endpoint
3. alive-search-files(endpoint-pattern, "src/**")
4. IF edge function issue:
<!-- SUPABASE DISABLED:    5a. alive-view(supabase/functions/function-name/index.ts) -->
   5b. alive-line-replace(function-file, broken-logic, fixed-logic)
5. IF client issue:
   6a. alive-view(client-file)
   6b. alive-line-replace(client-file, broken-call, fixed-call)
```

### Path 3: Visual Bug (No Errors)
```
1. project_debug--sandbox-screenshot("/problem-path")
2. User describes what's wrong
3. alive-search-files(component-name, "src/**")
4. alive-view(component-file)
5. alive-line-replace(component-file, styling-issue, fixed-styling)
```

### Path 4: RLS/Database Error
```
1. alive-read-console-logs("permission denied|RLS|policy")
2. alive-search-files("from\\(['\"]table_name", "src/**")
3. alive-view(database-access-file)
4. Identify missing RLS policy or incorrect query
5. Provide SQL to user for RLS policy
6. IF client code issue: alive-line-replace(fix query)
```

## Critical Rules

1. **Always use debugging tools FIRST** - Don't guess, gather data
2. **Read logs before reading code** - Error messages guide you to the problem
3. **Network tab shows API issues** - Check before assuming code bug
4. **Stack traces are breadcrumbs** - Follow them to exact file/line
5. **Parallel file reading** - If multiple files are implicated, read together
6. **Don't fix blindly** - Understand root cause before changing code
7. **Test tools don't update** - Don't re-run logs expecting new data during same turn

## Common Mistakes

❌ Reading code without checking logs first
❌ Making changes without understanding root cause
❌ Reading files sequentially when parallel is faster
❌ Assuming error is where user thinks it is
❌ Not checking network tab for API failures
❌ Re-running debugging tools multiple times (they don't update)
❌ Fixing symptoms instead of root cause
