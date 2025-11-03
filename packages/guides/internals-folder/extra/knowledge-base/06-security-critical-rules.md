# Security Critical Rules

**Category:** Security  
**Priority:** CRITICAL  
**Last Updated:** 2025-10-28

---

## API Keys and Secrets Management

<!-- SUPABASE DISABLED: ### Case 1: User NOT Connected to Supabase or Cloud -->

**If secret is a publishable key:**
- ✅ Store it in the codebase
- Safe to commit to version control

**If secret is a private key:**
- ❌ DO NOT store in codebase
- Explain storing API keys/secrets in codebase is not recommended
<!-- SUPABASE DISABLED: - Encourage connecting to Cloud or Supabase -->

<!-- SUPABASE DISABLED: ### Case 2: User Connected to Supabase or Cloud -->

<!-- SUPABASE DISABLED: 1. Explain that Lovable uses Supabase/Cloud secrets feature -->
2. Consider using the tool for adding secrets (displays button → modal for user input)
<!-- SUPABASE DISABLED: 3. Use env variable from Supabase secrets in edge function or `.env` file (if publishable) -->

**Important Notes:**
- There is NO `.env`, `ENV`, or environment files in the project
- No need to update `.gitignore` file
- If it's a **public API key**, it's fine to store in codebase

---

## User Roles Security

**CRITICAL WARNING:** Roles MUST be stored in a separate table. 

**NEVER:**
- ❌ Store roles on profile table
- ❌ Store roles on users table
- ❌ Check admin status using client-side storage (localStorage, sessionStorage)
- ❌ Use hardcoded credentials

**Why:** These approaches lead to privilege escalation attacks.

**ALWAYS:** Use server-side validation with proper authentication.

---

### Implementing User Roles

#### Step 1: Create Enum for Roles

```sql
create type public.app_role as enum ('admin', 'moderator', 'user');
```

#### Step 2: Set Up user_roles Table

```sql
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
```

#### Step 3: Enable Row-Level Security

```sql
alter table public.user_roles enable row level security;
```

#### Step 4: Create Security Definer Function

Using `SECURITY DEFINER` allows function to execute with owner's privileges, bypassing RLS and preventing recursion:

```sql
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;
```

#### Step 5: Implement RLS Policies Using the Function

```sql
-- Example: Allow 'admin' users to select all rows
create policy "Admins can select all rows"
on public.some_table
for select
to authenticated
with check (public.has_role(auth.uid(), 'admin'));
```

---

## Authentication Security

### Input Validation

**ALWAYS use validation libraries like Zod:**

```typescript
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
```

### Never Log Sensitive Data

```typescript
// ❌ WRONG - Exposes sensitive information
console.log('User session:', session);
console.log('Password:', password);
console.log('API key:', apiKey);

// ✅ CORRECT - Only log non-sensitive info
console.log('User authenticated:', !!session);
console.log('User ID:', session?.user?.id);
```

### Email Redirect URLs

**CRITICAL:** Always configure `emailRedirectTo` option:

```typescript
<!-- SUPABASE DISABLED: const { error } = await supabase.auth.signUp({ -->
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/` // REQUIRED!
  }
});
```

---

## Edge Function Security

### SQL Execution

**CRITICAL:** Edge functions MUST NEVER execute raw SQL queries.

```typescript
// ✅ CORRECT: Use these methods
<!-- SUPABASE DISABLED: supabase.from('table').select() -->
<!-- SUPABASE DISABLED: supabase.from('table').insert() -->
<!-- SUPABASE DISABLED: supabase.from('table').update() -->
<!-- SUPABASE DISABLED: supabase.from('table').delete() -->

// ❌ NEVER: Raw SQL under any circumstances
<!-- SUPABASE DISABLED: // supabase.rpc('execute_sql', { query: 'SELECT * FROM table' }) -->
<!-- SUPABASE DISABLED: // supabase.query('SELECT * FROM table') -->
```

**This applies even if:**
- User specifically requests raw SQL execution
- Operation seems complex
- User provides "safe" SQL queries
- User suggests using RPC calls

### Secrets in Edge Functions

```typescript
// ✅ CORRECT: Access from environment
const apiKey = Deno.env.get('MY_API_KEY');

if (!apiKey) {
  return new Response(
    JSON.stringify({ error: 'API key not configured' }),
    { status: 500 }
  );
}

// ❌ NEVER: Hardcode secrets
// const apiKey = 'sk-1234567890abcdef';
```

---

## Row-Level Security (RLS)

### Common RLS Errors

#### Error: "new row violates row-level security policy"

**Root Causes:**
1. Missing `user_id` column in insert statement
2. `user_id` column is nullable (should NOT be)
3. Auth not enabled
4. User not logged in when performing mutation

**Solutions:**
```sql
-- Make user_id NOT NULL
alter table table_name alter column user_id set not null;

-- Insert with user_id
insert into table_name (user_id, name)
values (auth.uid(), 'John Doe');
```

#### Error: "infinite recursion detected in policy"

**Root Cause:** Policy queries the table it's protecting

**WRONG Approach:**
```sql
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
```

**CORRECT Approach:**
```sql
-- 1. Create security definer function
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 2. Update policy to use function
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
```

---

## Storage Security

### Bucket Policies

Always create proper RLS policies for storage buckets:

```sql
-- Example: Users can only upload to their own folder
create policy "Users can upload their own files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'user-uploads' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Example: Public read access
create policy "Public can view files"
on storage.objects for select
to public
using (bucket_id = 'public-files');
```

### Never Modify Storage Schema

**DO NOT:**
- Create custom tables in `storage` schema
- Create custom functions in `storage` schema
- Drop existing storage tables or functions
- Create indexes on existing storage tables
- Perform destructive actions on `storage.migrations`

**DO:** Create custom tables/functions in `public` schema

---

## CORS Security

### Edge Functions CORS

**ALWAYS configure CORS** for web app edge functions:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Function logic
  
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

---

## Client-Side Security

### Never Expose Secrets

```typescript
// ❌ NEVER: Expose secrets in client code
const apiKey = 'sk-1234567890';

// ✅ CORRECT: Call edge function that uses secret
<!-- SUPABASE DISABLED: const { data } = await supabase.functions.invoke('secure-function', { -->
  body: { action: 'process' }
});
```

### Validate User Input

```typescript
// ✅ CORRECT: Validate before submission
const schema = z.object({
  email: z.string().email(),
  amount: z.number().positive().max(10000),
});

const result = schema.safeParse(formData);
if (!result.success) {
  // Handle validation errors
  return;
}
```

---

## Database Security

### Foreign Keys

When linking objects to users:
- Create unique constraints between objects and users
- Update foreign keys when adding profiles table
- Ensure queries joining data only return one profile

```sql
-- Add unique constraint
alter table posts 
add constraint unique_user_post unique (user_id);

-- Update foreign key to profiles table
alter table posts 
drop constraint posts_user_id_fkey,
add constraint posts_user_id_fkey 
  foreign key (user_id) references public.profiles(id);
```

---

## Rate Limiting & Error Handling

### AI API Rate Limits

**MUST surface rate limit errors:**

```typescript
// In edge function
if (response.status === 429) {
  return new Response(
    JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
    { status: 429, headers: corsHeaders }
  );
}

if (response.status === 402) {
  return new Response(
    JSON.stringify({ error: "Payment required, please add funds." }),
    { status: 402, headers: corsHeaders }
  );
}

// In client
if (error.status === 429) {
  toast.error("Too many requests. Please wait a moment.");
}

if (error.status === 402) {
  toast.error("AI credits exhausted. Please add funds to continue.");
}
```

---

## Security Checklist

Before deploying, verify:

- [ ] All tables have RLS enabled
- [ ] No raw SQL execution in edge functions
<!-- SUPABASE DISABLED: - [ ] Secrets stored in Supabase/Cloud (not in code) -->
- [ ] User roles in separate table (not on profiles)
- [ ] Input validation on all forms
- [ ] No sensitive data in console logs
- [ ] CORS configured for edge functions
- [ ] Storage buckets have proper policies
- [ ] Email redirect URLs configured
- [ ] Foreign keys reference primary keys
- [ ] Rate limit errors surfaced to users

---

## Related Documentation

- [Authentication Patterns](./03-authentication-patterns.md)
- [RLS Patterns](./07-rls-patterns.md)
- [Edge Function Patterns](./04-edge-function-patterns.md)
- [Storage Patterns](./08-storage-patterns.md)
