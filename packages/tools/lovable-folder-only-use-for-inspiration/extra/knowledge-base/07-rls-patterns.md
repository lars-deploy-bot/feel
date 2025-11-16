# Row-Level Security (RLS) Patterns

**Category:** Database Security  
**Priority:** CRITICAL  
**Last Updated:** 2025-10-28

---

## What is Row-Level Security?

Row-Level Security (RLS) is PostgreSQL's way of controlling which rows users can access in database tables. It's essential for multi-tenant applications and user-specific data protection.

---

## Enabling RLS

**ALWAYS enable RLS on tables containing user data:**

```sql
alter table public.table_name enable row level security;
```

**Without RLS:** Any authenticated user can access all rows in the table.

---

## Common RLS Policy Patterns

### Pattern 1: Users Can Only Access Their Own Data

```sql
-- Users can select their own rows
create policy "Users can view own data"
on public.posts
for select
to authenticated
using (auth.uid() = user_id);

-- Users can insert their own rows
create policy "Users can create own data"
on public.posts
for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can update their own rows
create policy "Users can update own data"
on public.posts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Users can delete their own rows
create policy "Users can delete own data"
on public.posts
for delete
to authenticated
using (auth.uid() = user_id);
```

---

### Pattern 2: Public Read, Authenticated Write

```sql
-- Anyone can read
create policy "Public read access"
on public.posts
for select
to public
using (true);

-- Only authenticated users can create
create policy "Authenticated users can create"
on public.posts
for insert
to authenticated
with check (auth.uid() = user_id);
```

---

### Pattern 3: Role-Based Access

**CRITICAL:** Use security definer function to avoid infinite recursion:

```sql
-- Create role check function
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

-- Apply policy using function
create policy "Admins can view all data"
on public.posts
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin') or
  auth.uid() = user_id
);

create policy "Admins can update all data"
on public.posts
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin') or
  auth.uid() = user_id
);
```

---

### Pattern 4: Organization/Team-Based Access

```sql
-- Users can access data from their organization
create policy "Organization members can view"
on public.documents
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members
    where organization_id = documents.organization_id
      and user_id = auth.uid()
  )
);
```

---

### Pattern 5: Public with Private Flag

```sql
-- Anyone can view public posts, users can view their own private posts
create policy "View public or own posts"
on public.posts
for select
to public
using (
  is_public = true or
  auth.uid() = user_id
);
```

---

## Common RLS Errors and Solutions

### Error 1: "new row violates row-level security policy"

**Symptoms:**
- Insert or update fails with RLS violation
- User is authenticated but still can't insert

**Root Causes:**

1. **Missing user_id in insert:**
   ```sql
   -- ❌ WRONG: user_id not set
   insert into posts (title, content)
   values ('Hello', 'World');
   
   -- ✅ CORRECT: user_id set to current user
   insert into posts (user_id, title, content)
   values (auth.uid(), 'Hello', 'World');
   ```

2. **Nullable user_id column:**
   ```sql
   -- ❌ PROBLEM: user_id can be NULL
   create table posts (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users(id),  -- nullable!
     title text
   );
   
   -- ✅ SOLUTION: Make user_id NOT NULL
   alter table posts alter column user_id set not null;
   ```

3. **User not authenticated:**
   ```typescript
   // ✅ Check auth before mutation
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     console.error('User must be logged in');
     return;
   }
   
   // Now safe to insert
   const { data, error } = await supabase
     .from('posts')
     .insert({ user_id: user.id, title: 'Hello' });
   ```

---

### Error 2: "infinite recursion detected in policy"

**Symptoms:**
- Policy creation fails
- Query hangs indefinitely
- Database becomes unresponsive

**Root Cause:** Policy queries the table it's protecting

**❌ WRONG Approach:**
```sql
-- This creates infinite recursion!
CREATE POLICY "Admins can view all profiles" 
ON public.profiles
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  -- ↑ Queries profiles table from within profiles policy!
);
```

**✅ CORRECT Approach:**

```sql
-- Step 1: Create security definer function
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles  -- Different table!
    where user_id = _user_id
      and role = _role
  )
$$;

-- Step 2: Use function in policy
CREATE POLICY "Admins can view all profiles" 
ON public.profiles
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin')
);
```

**Why it works:**
- Function uses `SECURITY DEFINER` to bypass RLS
- Queries different table (`user_roles` instead of `profiles`)
- Breaks the recursion cycle

---

### Error 3: "permission denied for table"

**Symptoms:**
- Query fails despite correct policy
- User can't access expected data

**Root Causes:**

1. **RLS not enabled:**
   ```sql
   -- Check if RLS is enabled
   select tablename, rowsecurity 
   from pg_tables 
   where schemaname = 'public';
   
   -- Enable RLS
   alter table public.posts enable row level security;
   ```

2. **No matching policy:**
   ```sql
   -- Check existing policies
   select * from pg_policies where tablename = 'posts';
   
   -- Create missing policy
   create policy "Users can view own posts"
   on public.posts
   for select
   to authenticated
   using (auth.uid() = user_id);
   ```

3. **Policy on wrong operation:**
   ```sql
   -- ❌ Only SELECT policy exists
   create policy "View posts"
   on public.posts
   for select
   to authenticated
   using (auth.uid() = user_id);
   
   -- ✅ Add INSERT policy
   create policy "Create posts"
   on public.posts
   for insert
   to authenticated
   with check (auth.uid() = user_id);
   ```

---

## Storage RLS Patterns

### Pattern 1: User-Specific Folders

```sql
-- Users can only upload to their own folder
create policy "Users upload to own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-files' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can only access their own files
create policy "Users access own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-files' and
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### Pattern 2: Public Bucket with Private Folders

```sql
-- Public read access
create policy "Public read access"
on storage.objects
for select
to public
using (bucket_id = 'public-files');

-- Authenticated write to own folder
create policy "Authenticated write to own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-files' and
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### Pattern 3: Admin Override

```sql
-- Admins can access all files, users can access their own
create policy "Admin or own file access"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'secure-files' and (
    public.has_role(auth.uid(), 'admin') or
    auth.uid()::text = (storage.foldername(name))[1]
  )
);
```

---

## Testing RLS Policies

### Method 1: Using Supabase Client

```typescript
// As authenticated user
const { data, error } = await supabase
  .from('posts')
  .select('*');

console.log('Can see:', data?.length, 'posts');
```

### Method 2: Using SQL (as specific user)

```sql
-- Switch to specific user context
set local role authenticated;
set local request.jwt.claims.sub = 'user-uuid-here';

-- Test query
select * from posts;

-- Reset
reset role;
```

### Method 3: Check Policy Coverage

```sql
-- List all policies for a table
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'posts';
```

---

## Best Practices

### 1. Always Set user_id on Insert

```typescript
// ✅ CORRECT
const { data, error } = await supabase
  .from('posts')
  .insert({
    user_id: user.id,  // ALWAYS set this!
    title: 'My Post',
    content: 'Content here'
  });
```

### 2. Make user_id NOT NULL

```sql
-- When creating table
create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),  -- NOT NULL!
  title text
);

-- When altering existing table
alter table posts alter column user_id set not null;
```

### 3. Use Security Definer Functions for Complex Logic

```sql
-- For role checks, organization access, etc.
create or replace function check_access(...)
returns boolean
language sql
stable
security definer  -- Bypass RLS within function
set search_path = public
as $$
  -- Complex logic here
$$;
```

### 4. Create Policies for All Operations

```sql
-- Don't forget DELETE and UPDATE!
create policy "Users can delete own posts"
on public.posts
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can update own posts"
on public.posts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 5. Test Before Deploying

```sql
-- Create test user
insert into auth.users (id, email)
values ('test-uuid', 'test@example.com');

-- Test as that user
set local role authenticated;
set local request.jwt.claims.sub = 'test-uuid';

-- Run queries
select * from posts;  -- Should only see test user's posts

reset role;
```

---

## RLS Policy Checklist

Before deploying tables with RLS:

- [ ] RLS enabled on all user data tables
- [ ] Policies created for SELECT, INSERT, UPDATE, DELETE
- [ ] `user_id` column is NOT NULL
- [ ] Policies use security definer functions (not self-referencing queries)
- [ ] Storage buckets have appropriate policies
- [ ] Tested with multiple user contexts
- [ ] Role-based policies use separate `user_roles` table
- [ ] Public/private data clearly separated
- [ ] Foreign keys reference primary keys (not unique constraints)

---

## Related Documentation

- [Security Critical Rules](./06-security-critical-rules.md)
- [Authentication Patterns](./03-authentication-patterns.md)
- [Supabase Integration Patterns](./02-supabase-integration-patterns.md)
- [Storage Patterns](./08-storage-patterns.md)
