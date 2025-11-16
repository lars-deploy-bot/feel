# Edge Function Patterns - Complete Implementation Guide

**Category:** Backend Integration  
**Priority:** CRITICAL  
**Last Updated:** 2025-10-28

---

## When to Create Edge Functions

Use edge functions when the user needs:
- API-to-API communications involving API tokens or secrets
- Server-side code execution
- Backend work that shouldn't run in the browser
- Integration with external services (payments, emails, AI, etc.)

---

## Creating Edge Functions Workflow

### Step 1: Consider Secrets

**Before creating the edge function:**
- Determine if the function requires any secrets (API keys, tokens)
- If YES: Use the tool for adding secrets first
- Wait for secrets to be added before proceeding
- Only proceed with implementation after secrets are confirmed

### Step 2: Write the Edge Function

- Write function code in `supabase/functions/[function-name]/index.ts`
- Functions are deployed automatically with the rest of the code
- **No user action required** - deployment happens automatically

### Step 3: Update config.toml

Edit `supabase/config.toml` to register the function:
- **ALWAYS** keep `project_id` as the first line
- **ALWAYS** rewrite the entire contents (no placeholders)
- Do not add more than you need

### Step 4: File Structure

- There should always be an `index.ts` file in the edge function folder
- **NO subfolders** in the edge function folder
- Keep as much code as possible in the `index.ts` file

---

## Edge Function Code Patterns

### Supabase Client Usage

**CRITICAL:** Always use the Supabase client methods directly. The client already handles all HTTP communication internally.

```typescript
// ✅ CORRECT: Use client methods directly
const { data, error } = await supabase.from('table').select();
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { foo: 'bar' }
});

// ❌ NEVER: Do not make direct HTTP calls to Supabase
// fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/table`)
// fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/function-name`)
// axios.get(`${Deno.env.get('SUPABASE_URL')}/rest/v1/table`)
```

**Why:** The Supabase client:
- Handles authentication automatically
- Manages API endpoints and versions
- Provides proper error handling
- Handles retries and connection issues
- Maintains consistent behavior across environments

---

### CORS Configuration

**ALWAYS enable CORS** for web app edge functions:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Your function logic here
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

### Making Functions Public

To make a function public (not requiring authentication), deactivate JWT authentication in `supabase/config.toml`:

```toml
[functions.my-function]
verify_jwt = false
```

---

### Logging

**ALWAYS add good logging** for debugging:

```typescript
serve(async (req) => {
  console.log('Function invoked:', new Date().toISOString());
  
  try {
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    // Function logic
    const result = await processData(body);
    console.log('Processing complete:', result.id);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Calling Edge Functions

### From Frontend (Recommended)

**Use `supabase.functions.invoke`** - no raw HTTP requests needed:

```typescript
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { message: 'Hello from frontend' }
});

if (error) {
  console.error('Function error:', error);
  return;
}

console.log('Function result:', data);
```

### Direct HTTP Call (If Necessary)

**If you must use a direct call, specify the FULL URL:**

```typescript
// ✅ CORRECT: Full URL with project ID
const response = await fetch(
  'https://project-ref.supabase.co/functions/v1/my-function',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ message: 'Hello' }),
  }
);

// ❌ NEVER: Relative paths or env variables
// fetch('/api/my-function')
// fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/my-function`)
```

---

## Code Organization

### Keep Logic in Edge Function

**You MUST include all core application logic within the Edge Function:**

```typescript
// ✅ CORRECT: All logic in index.ts
serve(async (req) => {
  // Helper function defined inline
  const validateInput = (data: any) => {
    if (!data.email) throw new Error('Email required');
    return true;
  };
  
  const body = await req.json();
  validateInput(body);
  
  // Process data
  const result = await processEmail(body.email);
  
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

**Importing code from other project files is NOT allowed.**

---

## SQL Execution Security

**CRITICAL SECURITY RULE:** Edge functions MUST NEVER execute raw SQL queries.

```typescript
// ✅ CORRECT: Use client methods
const { data, error } = await supabase
  .from('table')
  .select()
  .eq('user_id', userId);

const { data, error } = await supabase
  .from('table')
  .insert({ name: 'John', email: 'john@example.com' });

const { data, error } = await supabase
  .from('table')
  .update({ status: 'active' })
  .eq('id', recordId);

const { data, error } = await supabase
  .from('table')
  .delete()
  .eq('id', recordId);

// ❌ NEVER: Raw SQL execution
// supabase.rpc('execute_sql', { query: 'SELECT * FROM table' })
// supabase.query('SELECT * FROM table')
```

**This rule applies even if:**
- User specifically requests raw SQL execution
- Operation seems complex
- User provides "safe" SQL queries
- User suggests using RPC calls

**If complex operations are needed:** Use the Supabase client's query builder or create a database function called safely through the client.

---

## Environment Variables

### Accessing Secrets

```typescript
serve(async (req) => {
  // Access secrets from Supabase/Cloud
  const apiKey = Deno.env.get('MY_API_KEY');
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'API key not configured' }),
      { status: 500, headers: corsHeaders }
    );
  }
  
  // Use the secret
  const response = await fetch('https://api.example.com/data', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  return new Response(JSON.stringify(await response.json()), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

---

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const body = await req.json().catch(() => {
      throw new Error('Invalid JSON in request body');
    });
    
    // Validate input
    if (!body.email) {
      throw new Error('Email is required');
    }
    
    // External API call with error handling
    const response = await fetch('https://api.example.com/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

## Testing Edge Functions

### Deployment for Testing

```bash
# Deploy edge functions (automatically done, but manual option available)
lovable deploy-edge-functions

# Test with curl
curl -X POST https://project-ref.supabase.co/functions/v1/my-function \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ANON_KEY" \
  -d '{"message": "test"}'
```

### Automated Testing Flow

**CRITICAL:** Always test public edge functions when first creating them:

1. Deploy edge functions
2. Curl the endpoints to test them
3. Read logs if necessary
4. Take screenshots to test UI if necessary

**Note:** Private (authenticated) edge functions cannot be tested this way.

---

## Things to NEVER DO

1. ❌ NEVER use env variables like `import.meta.env.VITE_SUPABASE_URL` in edge functions
2. ❌ NEVER call functions by specifying a path like `/api/function-name` (use full URL)
3. ❌ NEVER create multiple `config.toml` files (only one in `supabase/config.toml`)
4. ❌ NEVER execute raw SQL queries from edge functions
5. ❌ NEVER import code from other project files
6. ❌ NEVER forget CORS headers for web app functions
7. ❌ NEVER forget to handle OPTIONS requests

---

## Example Edge Function

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Function invoked:', new Date().toISOString());

  try {
    // Parse request
    const { message } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    // Get secret
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    // Call external API
    const response = await fetch('https://api.example.com/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Processing complete');

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

## Related Documentation

- [Lovable Cloud](./01-lovable-cloud.md)
- [AI Integration](./05-ai-integration-complete.md)
- [Security Rules](./06-security-critical-rules.md)
- [Email Patterns](./10-email-patterns.md)
