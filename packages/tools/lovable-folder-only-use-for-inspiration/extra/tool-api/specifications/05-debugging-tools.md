# Debugging Tools

5 tools for diagnosing errors, inspecting logs, monitoring network, and analyzing user sessions.

---

## `lov-read-console-logs`

Read browser console output captured when user sent message.

**Signature:**
```typescript
lov-read-console-logs(search?: string): string
```

**Parameters:**
- `search` (optional): Filter logs by keyword
  - Examples: `"error"`, `"warning"`, `"undefined"`, `"UserProfile"`

**Returns:** Console log output (errors, warnings, logs, info)

**Usage:**
```typescript
// Get all recent console output
lov-read-console-logs()

// Filter for errors only
lov-read-console-logs("error")

// Filter for specific component
lov-read-console-logs("UserProfile")

// Filter for undefined variables
lov-read-console-logs("undefined")

// Filter for API errors
lov-read-console-logs("fetch")
```

**Output Includes:**
- Error messages with stack traces
- Warning messages
- `console.log()`, `console.info()`, `console.debug()` output
- Timestamps
- Source file and line numbers

**Critical Rules:**
- ✅ **USE FIRST** when debugging bugs or errors
- ⚠️ Logs are snapshot from when user sent message (don't update during your response)
- ✅ Large outputs stored in `tool-results://console-logs-[timestamp].txt`
- ❌ **CANNOT** execute this more than once per turn (same logs every time)
- ✅ Use to identify:
  - Runtime errors
  - Type errors  
  - Failed API calls
  - Uncaught exceptions
  - Prop validation errors

---

## `lov-read-network-requests`

Read all network activity (API calls, responses, timing) captured when user sent message.

**Signature:**
```typescript
lov-read-network-requests(search?: string): NetworkRequest[]
```

**Parameters:**
- `search` (optional): Filter requests by URL, status, or content
  - Examples: `"api"`, `"error"`, `"/users"`, `"500"`, `"supabase"`

**Returns:** Array of network requests with full details

**Usage:**
```typescript
// Get all network requests
lov-read-network-requests()

// Filter for API calls only
lov-read-network-requests("api")

// Filter for failed requests
lov-read-network-requests("error")

// Filter for specific endpoint
lov-read-network-requests("/auth/login")

// Filter for Supabase calls
lov-read-network-requests("supabase")

// Filter by status code
lov-read-network-requests("404")
```

**Output Includes:**
- Request URL, method, headers
- Request body/payload
- Response status code
- Response headers
- Response body
- Timing information (duration)
- Errors (CORS, network failures)

**Critical Rules:**
- ✅ Use when debugging API issues or performance
- ✅ Shows complete request/response cycle
- ✅ Reveals CORS errors, auth failures, malformed requests
- ✅ Large outputs stored in `tool-results://network-requests-[timestamp].json`
- ⚠️ Snapshot from when user sent message
- ✅ Use to diagnose:
  - API endpoint errors (404, 500, etc.)
  - Authentication failures
  - CORS issues
  - Payload/response format errors
  - Performance bottlenecks

---

## `lov-read-session-replay`

**CRITICAL DEBUGGING TOOL:** View complete recording of user's session leading up to their request.

**Signature:**
```typescript
lov-read-session-replay(): SessionReplay
```

**Parameters:** None

**Returns:** Complete timeline of user interactions and UI state

**Usage:**
```typescript
// View what user experienced
lov-read-session-replay()

// Returns timeline with:
// - Every click, scroll, input
// - Visual state at each step
// - Sequence of events
// - Actual UI the user saw
```

**What You See:**
- User's exact clicks and interactions
- Form inputs and changes
- Navigation between pages
- Visual state of components
- Timing of all events
- Complete context of the issue

**When to Use:**
User says:
- "It doesn't work"
- "I'm getting an error"
- "The button doesn't work"
- "I'm seeing a blank page"
- "It's flickering"
- "Validation isn't working"
- "Things aren't loading"

**Critical Rules:**
- ✅ **ALWAYS USE FIRST** when debugging user issues
- ✅ Shows EXACTLY what user experienced
- ✅ Captures complete context missing from logs alone
- ✅ See actual UI state (not just code)
- ❌ Without this, you're missing critical context
- ✅ Most important debugging tool

**Why This Matters:**
```typescript
// User reports: "Button doesn't work"

// Without session replay:
// - You guess which button
// - You assume what "doesn't work" means
// - You might fix the wrong thing

// With session replay:
// - See exact button user clicked
// - See what happened (or didn't happen)
// - See error messages user saw
// - Understand complete context
// - Fix the actual problem
```

---

## `project_debug--sandbox-screenshot`

Capture screenshot of app at specific route.

**Signature:**
```typescript
project_debug--sandbox-screenshot(path: string): string
```

**Parameters:**
- `path` (required): Route to capture
  - Examples: `"/"`, `"/dashboard"`, `"/profile"`, `"/products?id=123"`

**Returns:** Path to screenshot image (displays in chat)

**Usage:**
```typescript
// Screenshot homepage
project_debug--sandbox-screenshot("/")

// Screenshot dashboard
project_debug--sandbox-screenshot("/dashboard")

// Screenshot with query params
project_debug--sandbox-screenshot("/products?id=123")

// Screenshot after code changes (verify fix)
project_debug--sandbox-screenshot("/")
```

**What You See:**
- Visual rendering of page
- Layout and styling
- Top portion of page (standard viewport)
- Component visibility

**Use Cases:**
1. **Before fixing:** Verify visual issue exists
2. **After fixing:** Confirm fix worked
3. **Design verification:** Check UI matches requirements
4. **Regression testing:** Ensure changes didn't break other pages

**Critical Rules:**
- ✅ Useful for visual debugging (layout, styling, visibility)
- ⚠️ **CANNOT** access auth-protected pages (shows login page instead)
- ⚠️ If screenshot shows login, doesn't mean user sees login (they may be logged in)
- ✅ Only captures top of page (above fold)
- ✅ Use AFTER making UI changes to verify
- ❌ Not suitable for testing auth flows

**Limitations:**
```typescript
// ❌ Won't work as expected:
project_debug--sandbox-screenshot("/dashboard")
// If dashboard requires auth, shows login page

// ✅ Works well:
project_debug--sandbox-screenshot("/")  // Public homepage
project_debug--sandbox-screenshot("/pricing")  // Public pages
```

---

## `project_debug--sleep`

Wait for specified seconds (for async operations to complete).

**Signature:**
```typescript
project_debug--sleep(seconds: number): void
```

**Parameters:**
- `seconds` (required): How long to wait
  - Range: 1-60 seconds
  - Typical: 3-10 seconds

**Returns:** Success after waiting

**Usage:**
```typescript
// Wait for edge function deployment
project_debug--sleep(5)

// Wait for database migration
project_debug--sleep(3)

// Wait for cache invalidation
project_debug--sleep(10)

// Wait for build to propagate
project_debug--sleep(15)
```

**When to Use:**
- Edge functions just deployed (need time to propagate)
- Database migrations just ran
- Cache invalidation in progress
- Waiting for async build processes
- Logs not yet available after triggering action

**Critical Rules:**
- ⚠️ Use sparingly (adds latency to user experience)
- ✅ Useful for operations that need time to propagate
- ❌ Max 60 seconds
- ✅ Typical waits: 3-10 seconds
- ❌ Don't use for testing user actions (use session replay)

**Example Workflow:**
```typescript
// 1. Deploy edge function
lov-write("supabase/functions/api/index.ts", edgeFunctionCode)

// 2. Wait for deployment
project_debug--sleep(5)

// 3. Test the function
// (function is now live and testable)
```

---

## Debugging Workflows

### Error Reported

```typescript
// 1. Read session replay (see what user experienced)
lov-read-session-replay()

// 2. Check console for errors
lov-read-console-logs("error")

// 3. Check network if API-related
lov-read-network-requests("error")

// 4. Fix the issue

// 5. Verify fix (if UI-related)
project_debug--sandbox-screenshot("/")
```

### API Call Failing

```typescript
// 1. Check network requests
lov-read-network-requests("api")

// 2. Look for error responses (404, 500, CORS)

// 3. Check console for client-side errors
lov-read-console-logs("fetch")

// 4. Fix API call or backend

// 5. If backend changed, wait for deployment
project_debug--sleep(5)
```

### Visual Bug

```typescript
// 1. See what user experienced
lov-read-session-replay()

// 2. Take screenshot to verify
project_debug--sandbox-screenshot("/")

// 3. Fix styling/layout

// 4. Verify fix with screenshot
project_debug--sandbox-screenshot("/")
```

### "It doesn't work"

```typescript
// 1. ALWAYS start with session replay
lov-read-session-replay()

// 2. See exactly what user did and what happened

// 3. Check logs for errors
lov-read-console-logs()

// 4. Fix based on actual context
```

---

## Best Practices

**Always Debug Before Coding:**
- Don't guess at the problem
- Use tools to see actual issue
- Understand complete context
- Then fix with precision

**Use Multiple Tools Together:**
- Session replay shows user experience
- Console logs show runtime errors
- Network requests show API issues
- Screenshots verify visual fixes

**Don't Debug Blindly:**
```typescript
// ❌ Bad: Guess and modify code
// User: "Login doesn't work"
// You: *modifies login code randomly*

// ✅ Good: Debug first, then fix
lov-read-session-replay()  // See what user did
lov-read-console-logs("error")  // See error message
lov-read-network-requests("/auth")  // Check API call
// *Now fix the actual problem*
```

**Verify Fixes:**
```typescript
// After fixing visual issue:
project_debug--sandbox-screenshot("/")

// After fixing API:
// Have user test (can't verify auth-protected API via tools)
```
