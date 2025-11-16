# Edge Function Error Patterns

## Complete Guide to Serverless Function Debugging

Edge functions are serverless functions that run on Supabase. This guide covers all common error patterns.

---

## Error 1: "Function Not Found" (404)

### Error Message
```
FunctionsHttpError: Function not found
```

### Causes & Solutions

**Cause 1: Function not deployed**
```bash
# Check if function exists in Supabase Dashboard
# Functions > Edge Functions > List

# Deploy function
# Functions are auto-deployed in Lovable when saved
```

**Cause 2: Wrong function name in URL**
```typescript
// ❌ Wrong - Function name doesn't match folder
const { data, error } = await supabase.functions.invoke('myfunction');
// But folder is: supabase/functions/my-function/

// ✅ Correct - Match folder name exactly
const { data, error } = await supabase.functions.invoke('my-function');
```

**Cause 3: Case sensitivity**
```typescript
// Function names are case-sensitive
// Folder: supabase/functions/sendEmail/
// ❌ Wrong
supabase.functions.invoke('sendemail');

// ✅ Correct
supabase.functions.invoke('sendEmail');
```

---

## Error 2: CORS Errors

### Error Message
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

### Cause
Missing CORS headers in edge function response.

### Solution
```typescript
// ❌ Wrong - No CORS headers
Deno.serve(async (req) => {
  return new Response(JSON.stringify({ message: 'Hello' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ✅ Correct - Include CORS headers
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Regular response with CORS
  return new Response(
    JSON.stringify({ message: 'Hello' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});
```

---

## Error 3: "Failed to invoke function" / 500 Internal Error

### Error Message
```
FunctionsHttpError: Failed to invoke function
```

### Causes & Solutions

**Cause 1: Unhandled error in function**
```typescript
// ❌ Wrong - Error crashes function
Deno.serve(async (req) => {
  const data = await req.json();
  const result = data.items.map(x => x.value); // Crashes if items undefined
  return new Response(JSON.stringify(result));
});

// ✅ Correct - Handle errors
Deno.serve(async (req) => {
  try {
    const data = await req.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      return new Response(
        JSON.stringify({ error: 'Invalid input: items must be an array' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' 
          }
        }
      );
    }
    
    const result = data.items.map(x => x.value);
    return new Response(
      JSON.stringify({ result }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        }
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        }
      }
    );
  }
});
```

**Cause 2: Missing environment variables**
```typescript
// Check if required secrets exist
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  return new Response(
    JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
    { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    }
  );
}
```

**Cause 3: Timeout (exceeds 60 seconds)**
```typescript
// Edge functions have a 60-second timeout
// For long operations, return early and continue in background
// Or split into smaller operations
```

---

## Error 4: "Incorrect API key provided"

### Error Message
```
AuthError: Incorrect API key provided
```

### Cause
Using wrong Supabase key in edge function.

### Solution
```typescript
// ❌ Wrong - Using anon key from client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

// ✅ Correct - Use service role key to bypass RLS
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ✅ Or use anon key with user's auth token
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization')!,
      },
    },
  }
);
```

---

## Error 5: "Cannot read properties of undefined"

### Error Message
```
TypeError: Cannot read properties of undefined (reading 'x')
```

### Cause
Accessing properties that don't exist.

### Solution
```typescript
// ❌ Wrong - No null checks
Deno.serve(async (req) => {
  const { data } = await req.json();
  const value = data.user.email; // Crashes if user undefined
});

// ✅ Correct - Use optional chaining
Deno.serve(async (req) => {
  const { data } = await req.json();
  const value = data?.user?.email;
  
  if (!value) {
    return new Response(
      JSON.stringify({ error: 'Email is required' }),
      { status: 400 }
    );
  }
});
```

---

## Error 6: "Unexpected end of JSON input"

### Error Message
```
SyntaxError: Unexpected end of JSON input
```

### Cause
Trying to parse empty or invalid JSON body.

### Solution
```typescript
// ❌ Wrong - Always expects JSON
Deno.serve(async (req) => {
  const body = await req.json(); // Crashes if body is empty
});

// ✅ Correct - Check content type and handle empty body
Deno.serve(async (req) => {
  const contentType = req.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    try {
      const body = await req.json();
      // Process body
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400 }
      );
    }
  } else {
    return new Response(
      JSON.stringify({ error: 'Content-Type must be application/json' }),
      { status: 400 }
    );
  }
});
```

---

## Error 7: "Import not found" / Module Errors

### Error Message
```
error: Uncaught (in promise) Error: Cannot find module
```

### Cause
Using npm imports incorrectly in Deno.

### Solution
```typescript
// ❌ Wrong - Node.js style imports don't work
import { someLib } from 'some-lib';

// ✅ Correct - Use npm: prefix for npm packages
import { someLib } from 'npm:some-lib@1.0.0';

// ✅ Or use Deno-compatible URLs
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ✅ Common imports for Supabase functions
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import Stripe from 'npm:stripe@14.0.0';
```

---

## Error 8: Database Query Fails in Edge Function

### Error Message
```
PostgrestError: relation "public.users" does not exist
```

### Causes & Solutions

**Cause 1: RLS blocking query**
```typescript
// ❌ Wrong - Using anon key, RLS blocks query
const { data, error } = await supabase
  .from('users')
  .select('*');

// ✅ Correct - Use service role to bypass RLS
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const { data, error } = await supabase
  .from('users')
  .select('*');
```

**Cause 2: Table doesn't exist**
```typescript
// Check table name is correct
// Verify in Supabase Dashboard > Table Editor
```

**Cause 3: Schema not specified**
```typescript
// ✅ Explicitly specify schema if not 'public'
const { data, error } = await supabase
  .schema('custom_schema')
  .from('users')
  .select('*');
```

---

## Error 9: "Network request failed" When Calling Edge Function

### Error Message
```
TypeError: Failed to fetch
```

### Causes & Solutions

**Cause 1: Function URL incorrect**
```typescript
// ❌ Wrong - Hardcoded URL
const response = await fetch('https://wrong-url.supabase.co/functions/v1/my-function');

// ✅ Correct - Use Supabase client
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { key: 'value' }
});
```

**Cause 2: Not passing required headers**
```typescript
// ❌ Wrong - Missing auth header
const response = await fetch(functionUrl, {
  method: 'POST',
  body: JSON.stringify({ data: 'value' })
});

// ✅ Correct - Include authorization
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(functionUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ data: 'value' })
});

// ✅ Better - Use Supabase client (handles auth automatically)
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { data: 'value' }
});
```

---

## Error 10: Secrets Not Available in Edge Function

### Error Message
```
Environment variable not found
```

### Cause
Secret not configured in Supabase.

### Solution
```typescript
// Check if secret exists
const apiKey = Deno.env.get('MY_API_KEY');

if (!apiKey) {
  console.error('MY_API_KEY not found in environment');
  return new Response(
    JSON.stringify({ error: 'Configuration error: Missing API key' }),
    { status: 500 }
  );
}

// Add secret in Lovable:
// Use secrets management tool or
// Supabase Dashboard > Project Settings > Edge Functions > Secrets
```

---

## Edge Function Debugging Workflow

### Step 1: Check Function Logs
```
Supabase Dashboard > Edge Functions > Select function > Logs
Look for console.log output and error messages
```

### Step 2: Add Console Logs
```typescript
Deno.serve(async (req) => {
  console.log('Function invoked');
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers));
  
  try {
    const body = await req.json();
    console.log('Request body:', body);
    
    // Your logic here
    const result = await doSomething(body);
    console.log('Result:', result);
    
    return new Response(JSON.stringify(result));
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }
});
```

### Step 3: Test Locally (If Needed)
```bash
# Using Supabase CLI (if available)
supabase functions serve my-function

# Or test with curl
curl -i --location --request POST \
  'https://xxx.supabase.co/functions/v1/my-function' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

### Step 4: Check Response Headers
```typescript
// In frontend, log full response
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { test: true }
});

console.log('Response:', { data, error });
```

---

## Common Edge Function Patterns

### Pattern 1: Basic Function Structure
```typescript
Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // 2. Parse request
    const body = await req.json();
    
    // 3. Validate input
    if (!body.requiredField) {
      return new Response(
        JSON.stringify({ error: 'Missing required field' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }
    
    // 4. Do work
    const result = await processData(body);
    
    // 5. Return success
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error) {
    // 6. Handle errors
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});
```

### Pattern 2: Authenticated Function
```typescript
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401 }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  // Verify user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    );
  }

  // User is authenticated, proceed with function logic
  // ...
});
```

### Pattern 3: Third-Party API Integration
```typescript
Deno.serve(async (req) => {
  const apiKey = Deno.env.get('THIRD_PARTY_API_KEY');
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'API key not configured' }),
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://api.example.com/endpoint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: 'value' }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error) {
    console.error('Third-party API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to call third-party API' }),
      { status: 500 }
    );
  }
});
```

Remember: Edge functions are powerful but have limitations (60s timeout, no persistent storage). Always handle errors gracefully and log extensively for debugging.
