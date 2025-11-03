# Troubleshooting and Debugging Patterns

## Overview

Systematic debugging prevents wasted time and ensures accurate problem diagnosis. This guide establishes a methodical approach to troubleshooting issues in Alive applications.

## Debugging Workflow

Follow this sequence for every issue:

### 1. Gather Information (BEFORE touching code)

**Critical rule**: Use debugging tools FIRST, examine code SECOND.

```typescript
// Debugging tool sequence
1. Read console logs → alive-read-console-logs
2. Check network requests → alive-read-network-requests  
3. Take screenshots → project_debug--sandbox-screenshot
4. Review context → Check useful-context section
5. Search codebase → alive-search-files
6. Read relevant files → alive-view
```

**Why this order matters**:
- Console logs show actual runtime errors
- Network requests reveal API failures
- Screenshots confirm visual issues
- Context provides existing code
- Searching finds related code
- Reading gives full understanding

### 2. Reproduce the Issue

Before fixing, ensure you understand:

- **What**: Exact behavior observed
- **When**: Conditions that trigger it
- **Where**: Which component/function fails
- **Why**: Root cause (after investigation)

```typescript
// Document reproduction steps
/**
 * Issue: User profile fails to save
 * 
 * Steps to reproduce:
 * 1. Navigate to /profile
 * 2. Click "Edit Profile"
 * 3. Change email address
 * 4. Click "Save"
 * 
 * Expected: Success toast, updated profile
 * Actual: Error toast "Failed to update profile"
 * 
 * Console error: "TypeError: Cannot read property 'id' of undefined"
 * Network: POST /api/profile returns 500
 */
```

### 3. Isolate the Problem

Narrow down the failure point:

```typescript
// Systematic isolation
1. Frontend or backend? → Check network request success/failure
2. Which component? → Check component tree in React DevTools
3. Which function? → Add console.logs strategically
4. Which line? → Use error stack trace
```

### 4. Analyze Root Cause

Don't fix symptoms—fix the cause:

```typescript
// Example: "Cannot read property 'id' of undefined"

// ❌ Symptom fix - Masks the problem
if (user && user.id) {
  // do something
}

// ✅ Root cause fix - Prevents the problem
// Why is user undefined in the first place?
// Answer: Auth state not loaded yet

// Proper fix:
if (loading) return <Skeleton />
if (!user) return <Redirect to="/login" />

// Now user is guaranteed to exist
const userId = user.id
```

### 5. Implement Fix

Fix with confidence:

```typescript
// 1. Understand the problem completely
// 2. Plan the fix
// 3. Implement minimal change
// 4. Test the fix
// 5. Verify no regressions
```

### 6. Verify Fix

After implementing:

```typescript
// Verification checklist
- [ ] Original issue resolved
- [ ] No new console errors
- [ ] Network requests succeed
- [ ] UI displays correctly
- [ ] Edge cases handled
- [ ] No regressions in other features
```

## Common Issue Patterns

### Pattern 1: Authentication Errors

**Symptoms**:
- 401 Unauthorized responses
- "Invalid token" errors
- Redirects to login unexpectedly

**Debugging steps**:

```typescript
// 1. Check auth state
console.log('Auth state:', session, user)

// 2. Check token in request
<!-- SUPABASE DISABLED: const { data: { session } } = await supabase.auth.getSession() -->
console.log('Token:', session?.access_token)

// 3. Check RLS policies
// Do policies allow this operation for this user?

// 4. Check token expiration
console.log('Token expires:', new Date(session?.expires_at * 1000))
```

**Common fixes**:

```typescript
// Fix 1: Ensure session loaded before request
const [session, setSession] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
<!-- SUPABASE DISABLED:   supabase.auth.getSession().then(({ data: { session } }) => { -->
    setSession(session)
    setLoading(false)
  })
}, [])

if (loading) return <Skeleton />
if (!session) return <Navigate to="/login" />

// Fix 2: Include auth header correctly
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
})

// Fix 3: Refresh token if expired
<!-- SUPABASE DISABLED: supabase.auth.onAuthStateChange((event, session) => { -->
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully')
  }
})
```

### Pattern 2: State Update Issues

**Symptoms**:
- UI doesn't update after state change
- Stale data displayed
- Changes don't persist

**Debugging steps**:

```typescript
// 1. Verify state actually changes
useEffect(() => {
  console.log('State updated:', stateValue)
}, [stateValue])

// 2. Check if mutation succeeds
const handleUpdate = async () => {
  console.log('Before:', data)
  const result = await updateData()
  console.log('After:', result)
}

// 3. Verify component re-renders
console.log('Component rendered')
```

**Common fixes**:

```typescript
// Fix 1: Ensure proper state update
// ❌ Wrong - Mutating state directly
data.name = 'New Name'
setData(data)

// ✅ Correct - Create new object
setData({ ...data, name: 'New Name' })

// Fix 2: Handle async state updates
// ❌ Wrong - State not updated yet
setCount(count + 1)
console.log(count) // Still old value

// ✅ Correct - Use callback or useEffect
setCount(prev => {
  const newCount = prev + 1
  console.log(newCount)
  return newCount
})

// Fix 3: Invalidate queries after mutation
const { mutate } = useMutation(updateProfile, {
  onSuccess: () => {
    queryClient.invalidateQueries(['profile'])
  }
})
```

### Pattern 3: Network Request Failures

**Symptoms**:
- API calls return errors
- Requests timeout
- Data not loading

**Debugging steps**:

```typescript
// 1. Check network tab
alive-read-network-requests("error")

// 2. Log full request
const response = await fetch(url, {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(data)
})
console.log('Request:', { url, method: 'POST', headers, data })
console.log('Response:', response.status, await response.json())

// 3. Check CORS
// Look for "CORS policy" errors in console

// 4. Verify endpoint exists
// Is the URL correct?
// Is the edge function deployed?
```

**Common fixes**:

```typescript
// Fix 1: Add CORS headers (Edge Functions)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

// Fix 2: Handle errors properly
try {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  const data = await response.json()
  return data
} catch (error) {
  console.error('Request failed:', error)
  toast({
    title: 'Error',
    description: error.message,
    variant: 'destructive'
  })
}

// Fix 3: Add timeouts
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 10000)

try {
  const response = await fetch(url, { signal: controller.signal })
  // ...
} finally {
  clearTimeout(timeoutId)
}
```

### Pattern 4: Styling Issues

**Symptoms**:
- Components look wrong
- Responsive design breaks
- Dark mode issues
- Colors incorrect

**Debugging steps**:

```typescript
// 1. Take screenshot
project_debug--sandbox-screenshot("/")

// 2. Inspect element (DevTools)
// Check computed styles
// Verify Tailwind classes applied

// 3. Check color mode
console.log('Color mode:', document.documentElement.classList)

// 4. Verify design tokens
// Check index.css for CSS variables
```

**Common fixes**:

```typescript
// Fix 1: Use semantic colors, not direct colors
// ❌ Wrong
<div className="bg-white text-black">

// ✅ Correct
<div className="bg-background text-foreground">

// Fix 2: Ensure dark mode styles
// ❌ Wrong - No dark mode variant
<div className="bg-white">

// ✅ Correct - Dark mode considered
<div className="bg-background dark:bg-gray-900">

// Fix 3: Fix color function mismatches
// If index.css has rgb() colors:
--primary: rgb(255, 100, 50);

// Don't use hsl() in tailwind.config.ts
// ❌ Wrong
primary: 'hsl(var(--primary))'

// ✅ Correct  
primary: 'rgb(var(--primary))'
```

### Pattern 5: Data Not Displaying

**Symptoms**:
- Blank screen
- Empty lists
- "No data" shows incorrectly

**Debugging steps**:

```typescript
// 1. Check if data fetched
console.log('Data received:', data)

// 2. Check loading state
console.log('Loading:', loading)

// 3. Check error state
console.log('Error:', error)

// 4. Verify data structure
console.log('Data type:', typeof data, Array.isArray(data))
```

**Common fixes**:

```typescript
// Fix 1: Handle loading state
if (loading) return <Skeleton />
if (error) return <Error message={error.message} />
if (!data) return <EmptyState />

return <DataDisplay data={data} />

// Fix 2: Check data shape
// ❌ Wrong - Assuming structure
data.items.map(item => ...)

// ✅ Correct - Verify structure
const items = Array.isArray(data) ? data : data?.items || []
items.map(item => ...)

// Fix 3: Verify RLS policies allow read
// Check if SELECT policy exists for user's role
```

## Debugging Tools Usage

### Console Logs

```typescript
// Read all recent logs
alive-read-console-logs("")

// Search for specific errors
alive-read-console-logs("error")
alive-read-console-logs("undefined")
alive-read-console-logs("failed")
```

### Network Requests

```typescript
// Read all network activity
alive-read-network-requests("")

// Search for specific requests
alive-read-network-requests("api/profile")
alive-read-network-requests("error")
alive-read-network-requests("500")
```

### Screenshots

```typescript
// Capture specific routes
project_debug--sandbox-screenshot("/")
project_debug--sandbox-screenshot("/profile")
project_debug--sandbox-screenshot("/dashboard")
```

**Important limitations**:
- Cannot capture auth-protected pages (shows login)
- Only captures top of page (standard viewport)
- Use to verify layout, not dynamic content

## Strategic Console Logging

### Effective Logging

```typescript
// ✅ Good logging - Contextual and informative
console.log('User login attempt:', { email, timestamp: Date.now() })
console.log('Profile update result:', { success: true, updatedFields })
console.error('API call failed:', { error, endpoint, payload })

// ❌ Bad logging - Vague and unhelpful
console.log('here')
console.log('test')
console.log(data)
```

### Strategic Log Placement

```typescript
function updateUserProfile(userId: string, updates: ProfileUpdate) {
  console.log('📥 Update requested:', { userId, updates })
  
  try {
    const validated = validateProfile(updates)
    console.log('✅ Validation passed:', validated)
    
    const result = await saveProfile(userId, validated)
    console.log('💾 Save successful:', result)
    
    return { success: true, data: result }
  } catch (error) {
    console.error('❌ Update failed:', {
      userId,
      updates,
      error: error.message,
      stack: error.stack
    })
    return { success: false, error: error.message }
  }
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
// Edge function
serve(async (req) => {
  try {
    // Validate input
    const body = await req.json()
    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: 'userId required' }),
        { status: 400 }
      )
    }
    
    // Process request
    const result = await processRequest(body)
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Request failed:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500 }
    )
  }
})

// Frontend component
function ProfileEditor() {
  const { toast } = useToast()
  
  const handleSave = async (data: ProfileData) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Save failed')
      }
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully'
      })
      
    } catch (error) {
      console.error('Save failed:', error)
      
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }
}
```

## Testing Fixes

### Manual Testing Checklist

After fixing an issue:

```typescript
// 1. Primary fix verification
- [ ] Original issue no longer occurs
- [ ] Expected behavior works correctly

// 2. Regression testing
- [ ] Related features still work
- [ ] No new console errors
- [ ] No new network errors

// 3. Edge cases
- [ ] Works with empty data
- [ ] Works with maximum data
- [ ] Handles errors gracefully

// 4. Cross-browser (if visual)
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari (if accessible)

// 5. Responsive (if visual)
- [ ] Works on mobile viewport
- [ ] Works on tablet viewport
- [ ] Works on desktop viewport
```

## Common Pitfalls

### Pitfall 1: Fixing Without Understanding

```typescript
// ❌ Wrong - Adding checks without understanding why
if (data && data.items && data.items.length > 0) {
  // This masks the real issue
}

// ✅ Correct - Understand why data might be undefined
// Is the API call failing? Is RLS blocking access?
// Fix the root cause, not the symptom
```

### Pitfall 2: Over-fixing

```typescript
// ❌ Wrong - Adding unnecessary complexity
try {
  try {
    try {
      await saveData()
    } catch (e1) { /* handle */ }
  } catch (e2) { /* handle */ }
} catch (e3) { /* handle */ }

// ✅ Correct - Single appropriate error handler
try {
  await saveData()
} catch (error) {
  handleError(error)
}
```

### Pitfall 3: Ignoring Warnings

```typescript
// Console shows: "Warning: Each child should have unique key"
// ❌ Wrong - Ignoring the warning

// ✅ Correct - Fix the warning
items.map((item, index) => (
  <div key={item.id}>{item.name}</div>
))
```

---

**Key Principle**: Debug systematically using tools first, understand the root cause fully, then implement the minimal fix that addresses the actual problem—not just the symptoms.
