# API Keys and Secrets Management

## Overview

Proper secrets management is critical for application security. This guide covers how to handle API keys, tokens, and other sensitive credentials in Alive projects.

## Understanding Secret Types

### Public (Publishable) Keys
**Characteristics**:
- Designed to be exposed in frontend code
- Safe to commit to version control
- Limited privileges by design
- Examples: Stripe publishable key, Google Maps API key

**Handling**:
```typescript
// ✅ Safe to include directly in code
const STRIPE_PUBLISHABLE_KEY = "pk_test_..."
const GOOGLE_MAPS_KEY = "AIza..."
```

### Private (Secret) Keys
**Characteristics**:
- Must NEVER be exposed in frontend
- Grant full access to services
- Should never be in version control
- Examples: Stripe secret key, OpenAI API key, database passwords

**Handling**:
- Must use backend edge functions
- Store in Alive Cloud secrets
- Access via environment variables

## Decision Tree

### Is Alive Cloud Connected?

#### NO - Cloud Not Connected

**For publishable keys**:
```typescript
// ✅ Store directly in code (safe)
const MAPBOX_PUBLIC_TOKEN = "pk.eyJ1..."
```

**For private keys**:
```
❌ STOP - Do not implement yet
```

**Action required**:
1. Explain security risks of storing secrets in frontend
2. Recommend connecting to Alive Cloud
3. Wait for user confirmation before proceeding

**Important exception**: If the user explicitly confirms they understand the risks and want to proceed anyway, document the security implications clearly.

#### YES - Cloud Connected

Use Alive Cloud secrets management for all private keys.

## Alive Cloud Secrets Management

### Adding Secrets

Use the secrets tool to add new API keys:

```typescript
// This triggers a secure form for the user
secrets--add_secret({
  secret_names: ["OPENAI_API_KEY", "STRIPE_SECRET_KEY"]
})
```

**What happens**:
1. User sees a secure input form
2. User enters secret values
3. Secrets are encrypted and stored securely
4. Secrets become available as environment variables

### Accessing Secrets in Edge Functions

```typescript
<!-- SUPABASE DISABLED: // supabase/functions/my-function/index.ts -->
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Access via Deno.env
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'API key not configured' }),
      { status: 500 }
    )
  }
  
  // Use the secret
  const response = await fetch('https://api.openai.com/v1/...', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })
  
  // ... rest of logic
})
```

### Updating Secrets

```typescript
// Trigger update form
secrets--update_secret({
  secret_names: ["OPENAI_API_KEY"]
})
```

### Deleting Secrets

```typescript
// Trigger confirmation dialog
secrets--delete_secret({
  secret_names: ["OLD_API_KEY"]
})
```

<!-- SUPABASE DISABLED: **Important**: This only deletes user-created secrets, not integration secrets (like Supabase keys). -->

## Common Integration Patterns

### Pattern 1: OpenAI Integration

```typescript
<!-- SUPABASE DISABLED: // Edge function: supabase/functions/ai-completion/index.ts -->
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { status: 500, headers: corsHeaders }
    )
  }

  const { prompt } = await req.json()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

### Pattern 2: Stripe Integration

**Backend (Edge Function)**:
```typescript
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
```

**Frontend**:
```typescript
// ✅ Publishable key is safe in frontend
const stripe = loadStripe('pk_test_...')
```

### Pattern 3: SendGrid Email

```typescript
// Edge function
const sendgridKey = Deno.env.get('SENDGRID_API_KEY')

await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${sendgridKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    // email data
  }),
})
```

## Security Best Practices

### Never Do This

```typescript
// ❌ WRONG - Secret in frontend code
const OPENAI_API_KEY = "sk-proj-..."

// ❌ WRONG - Secret in version control
// .env (in git repository)
SECRET_KEY=abc123

// ❌ WRONG - Secret in URL parameters
fetch(`/api/data?apiKey=${secretKey}`)

// ❌ WRONG - Secret in localStorage
localStorage.setItem('apiKey', secretKey)
```

### Always Do This

```typescript
// ✅ CORRECT - Secret in edge function environment
const apiKey = Deno.env.get('SECRET_KEY')

// ✅ CORRECT - Publishable keys are OK in frontend
const publicKey = "pk_test_..."

// ✅ CORRECT - Secret accessed via authenticated API
const response = await fetch('/api/function', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
  },
})
```

### Secret Validation

Always validate secrets exist before using:

```typescript
function validateSecrets() {
  const required = ['OPENAI_API_KEY', 'STRIPE_SECRET_KEY']
  const missing = required.filter(key => !Deno.env.get(key))
  
  if (missing.length > 0) {
    throw new Error(`Missing secrets: ${missing.join(', ')}`)
  }
}

serve(async (req) => {
  validateSecrets()
  // ... proceed with logic
})
```

## Environment-Specific Secrets

### Development vs Production

Alive Cloud automatically handles environment separation:
- Development uses preview secrets
- Production uses production secrets
- No code changes needed

### Testing with Secrets

```typescript
// Use test mode keys in development
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') // sk_test_... in dev
```

## Secret Rotation

### When to Rotate
- Suspected compromise
- Employee offboarding
- Regular security schedule (quarterly)
- After security audit

### How to Rotate
1. Generate new secret in service dashboard
2. Use `secrets--update_secret` to update in Alive
3. Deploy changes
4. Verify new secret works
5. Revoke old secret in service dashboard

## Common Pitfalls

### Logging Secrets
```typescript
// ❌ WRONG - Logs expose secrets
console.log('API Key:', apiKey)

// ✅ CORRECT - Log safely
console.log('API Key configured:', !!apiKey)
```

### Error Messages
```typescript
// ❌ WRONG - Secret in error
throw new Error(`Auth failed with key ${apiKey}`)

// ✅ CORRECT - Safe error
throw new Error('Authentication failed')
```

### Client-Side Access
```typescript
// ❌ WRONG - Trying to access secrets in React
const key = import.meta.env.SECRET_KEY // Doesn't work, not secure

// ✅ CORRECT - Call edge function
const data = await fetch('/api/function')
```

## Troubleshooting

### Secret Not Found
**Symptom**: `Deno.env.get('KEY')` returns `undefined`

**Solutions**:
1. Verify secret is added via `secrets--add_secret`
2. Check exact name matches (case-sensitive)
3. Redeploy edge function after adding secret
4. Check for typos in secret name

### Permission Denied
**Symptom**: API returns 401/403 errors

**Solutions**:
1. Verify secret value is correct
2. Check API key has required permissions
3. Ensure key hasn't expired
4. Confirm service account is active

### Secret Exposure
**Symptom**: Secret accidentally committed to git

**Actions**:
1. Immediately revoke the secret in service dashboard
2. Generate new secret
3. Update in Alive Cloud
4. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
5. Force push cleaned history
6. Notify team members to re-clone

## Integration Checklist

Before implementing any third-party service:

- [ ] Identify which keys are public vs private
- [ ] Ensure Alive Cloud is connected (for private keys)
- [ ] Add secrets via `secrets--add_secret` tool
- [ ] Create edge function to access secrets
- [ ] Implement error handling for missing secrets
- [ ] Test with valid credentials
- [ ] Document required secrets in README
- [ ] Never log secret values
- [ ] Implement secret validation on startup

---

**Key Principle**: Private secrets must NEVER touch the frontend. Always use edge functions as the secure bridge between your frontend and sensitive credentials.
