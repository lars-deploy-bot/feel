# Secrets Management

## Secure Handling of API Keys and Environment Variables

This document covers best practices for managing secrets in Lovable projects.

---

## Secret Types

### 1. Supabase Secrets (Auto-Provisioned)

These are automatically available in edge functions:

```typescript
// Automatically available in edge functions
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
```

### 2. Lovable AI Key (Auto-Provisioned)

```typescript
// Automatically available for Lovable AI Gateway
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
```

### 3. User Secrets (Manual)

User adds these via Lovable UI or API:

```typescript
// User-provided secrets
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
```

---

## Adding Secrets

### Via Lovable AI

```typescript
// AI uses this tool to prompt user for secrets
await secrets--add_secret(["OPENAI_API_KEY", "STRIPE_SECRET_KEY"]);

// User sees secure form to enter values
// Values are encrypted and stored in Supabase
```

### Via Supabase Dashboard

1. Go to Project Settings → Edge Functions → Secrets
2. Click "Add Secret"
3. Enter name and value
4. Click "Save"

### Via Supabase CLI

```bash
# Set single secret
supabase secrets set OPENAI_API_KEY=sk-...

# Set multiple secrets from file
echo "OPENAI_API_KEY=sk-..." > .env.secrets
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env.secrets
supabase secrets set --env-file .env.secrets

# Verify secrets
supabase secrets list
```

---

## Using Secrets

### In Edge Functions

```typescript
// supabase/functions/chat/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // ✅ CORRECT: Read from environment
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
      { status: 500 }
    );
  }
  
  // Use secret
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ /* ... */ })
  });
  
  return new Response(JSON.stringify(await response.json()));
});
```

### In Frontend (NEVER!)

```typescript
// ❌ WRONG: Never put secrets in frontend
const OPENAI_API_KEY = "sk-..."; // EXPOSED TO USERS!

// ❌ WRONG: Never read secrets from import.meta.env
const apiKey = import.meta.env.VITE_OPENAI_API_KEY; // EXPOSED!

// ✅ CORRECT: Call backend, which uses secrets
const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`, // Public key is OK
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ message: "Hello" })
});
```

---

## Secret Naming Conventions

### Standard Patterns

```bash
# Service name + key type
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...  # OK to expose (marked as publishable)

# Service name + environment
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxx

# Feature + credential type
REDIS_URL=redis://...
DATABASE_URL=postgresql://...
```

### Naming Rules

- Use `SCREAMING_SNAKE_CASE`
- Be descriptive but concise
- Include environment if needed: `STRIPE_SECRET_KEY_PROD`
- Don't include the actual value in the name: `API_KEY` not `API_KEY_ABC123`

---

## Security Best Practices

### 1. Never Commit Secrets

```bash
# .gitignore (already configured in Lovable)
.env
.env.local
.env.secrets
*.key
*.pem
```

### 2. Use Different Keys Per Environment

```typescript
// ✅ GOOD: Separate keys for dev/staging/prod
const STRIPE_KEY = Deno.env.get(
  Deno.env.get("ENVIRONMENT") === "production"
    ? "STRIPE_SECRET_KEY_PROD"
    : "STRIPE_SECRET_KEY_TEST"
);
```

### 3. Rotate Secrets Regularly

```bash
# Rotate secret
supabase secrets unset OLD_API_KEY
supabase secrets set NEW_API_KEY=xxx

# Deploy functions to use new key
supabase functions deploy
```

### 4. Validate Secrets on Startup

```typescript
// Fail fast if secrets missing
const requiredSecrets = [
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "SENDGRID_API_KEY"
];

for (const secret of requiredSecrets) {
  if (!Deno.env.get(secret)) {
    throw new Error(`Missing required secret: ${secret}`);
  }
}
```

### 5. Never Log Secrets

```typescript
// ❌ WRONG: Exposes secret in logs
console.log("API Key:", OPENAI_API_KEY);

// ✅ CORRECT: Redact in logs
console.log("API Key:", OPENAI_API_KEY ? "[REDACTED]" : "missing");

// ✅ CORRECT: Only log that it exists
console.log("API Key configured:", !!OPENAI_API_KEY);
```

---

## Error Handling

### Missing Secrets

```typescript
function getRequiredSecret(name: string): string {
  const value = Deno.env.get(name);
  
  if (!value) {
    throw new Error(
      `Missing required secret: ${name}. ` +
      `Add it in Project Settings → Edge Functions → Secrets`
    );
  }
  
  return value;
}

// Usage
const OPENAI_API_KEY = getRequiredSecret("OPENAI_API_KEY");
```

### Invalid Secrets

```typescript
async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Validate on startup
const OPENAI_API_KEY = getRequiredSecret("OPENAI_API_KEY");
const isValid = await validateOpenAIKey(OPENAI_API_KEY);

if (!isValid) {
  throw new Error("OPENAI_API_KEY is invalid. Please check the key.");
}
```

---

## Frontend Environment Variables

### Public Variables (Safe to Expose)

```typescript
// vite.config.ts sets these automatically
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// These are PUBLIC - safe to expose in frontend
// They only allow access according to RLS policies
```

### Private Variables (Never Frontend!)

```typescript
// ❌ These should NEVER be in frontend
// SUPABASE_SERVICE_ROLE_KEY
// STRIPE_SECRET_KEY
// OPENAI_API_KEY

// ✅ Access via backend instead
const response = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
  headers: {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}` // Public key
  }
});
```

---

## Secret Scope

### Edge Function Scope

Each edge function has access to all secrets:

```typescript
// supabase/functions/chat/index.ts
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY"); // ✅ Available

// supabase/functions/payment/index.ts  
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY"); // ✅ Available
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY"); // ✅ Also available
```

**Limitation**: Cannot scope secrets to specific functions (all functions see all secrets).

**Workaround**: Use naming to indicate intended function:
```bash
CHAT_OPENAI_API_KEY=sk-...
PAYMENT_STRIPE_SECRET_KEY=sk-...
```

---

## Common Patterns

### Pattern 1: Multi-Service Configuration

```typescript
// Edge function using multiple services
const config = {
  openai: {
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    model: "gpt-4"
  },
  stripe: {
    secretKey: Deno.env.get("STRIPE_SECRET_KEY"),
    publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY")
  },
  sendgrid: {
    apiKey: Deno.env.get("SENDGRID_API_KEY"),
    fromEmail: "noreply@example.com"
  }
};

// Validate all required secrets
const required = [
  config.openai.apiKey,
  config.stripe.secretKey,
  config.sendgrid.apiKey
];

if (required.some(val => !val)) {
  throw new Error("Missing required secrets");
}
```

### Pattern 2: Secret with Fallback

```typescript
// Use primary key, fall back to secondary
const API_KEY = 
  Deno.env.get("PRIMARY_API_KEY") || 
  Deno.env.get("FALLBACK_API_KEY");

if (!API_KEY) {
  throw new Error("No API key available");
}
```

### Pattern 3: Environment-Specific Secrets

```typescript
const environment = Deno.env.get("ENVIRONMENT") || "development";

const secrets = {
  development: {
    stripeKey: Deno.env.get("STRIPE_SECRET_KEY_DEV")
  },
  production: {
    stripeKey: Deno.env.get("STRIPE_SECRET_KEY_PROD")
  }
};

const config = secrets[environment];
```

---

## Debugging Secrets

### Check If Secret Exists

```typescript
// Supabase CLI
supabase secrets list

// Edge function
console.log("Secrets configured:", {
  openai: !!Deno.env.get("OPENAI_API_KEY"),
  stripe: !!Deno.env.get("STRIPE_SECRET_KEY"),
  sendgrid: !!Deno.env.get("SENDGRID_API_KEY")
});
```

### Test Secret Locally

```bash
# Create .env.local (not committed)
echo "OPENAI_API_KEY=sk-..." > .env.local

# Run edge function locally with secrets
supabase functions serve --env-file .env.local

# Test
curl -X POST http://localhost:54321/functions/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

---

## Migration from Hardcoded Values

### Before (Insecure)

```typescript
// ❌ Hardcoded secret
const response = await fetch("https://api.openai.com/...", {
  headers: {
    Authorization: "Bearer sk-abc123xyz" // EXPOSED!
  }
});
```

### After (Secure)

```typescript
// ✅ Secret from environment
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  return new Response(
    JSON.stringify({ 
      error: "OPENAI_API_KEY not configured. Add it in Project Settings." 
    }),
    { status: 500 }
  );
}

const response = await fetch("https://api.openai.com/...", {
  headers: {
    Authorization: `Bearer ${OPENAI_API_KEY}`
  }
});
```

---

## Summary

**Key principles:**
1. **Never commit secrets** to git
2. **Never expose secrets** in frontend  
3. **Always use environment variables** in edge functions
4. **Validate secrets** on startup
5. **Rotate secrets** regularly

**Adding secrets workflow:**
1. Decide secret name (e.g., `OPENAI_API_KEY`)
2. Use `secrets--add_secret` tool or Supabase dashboard
3. Read in edge function with `Deno.env.get()`
4. Validate secret exists
5. Never log the actual value

**Remember**: Secrets in backend only, never in frontend. Use edge functions to proxy requests that need secrets.
