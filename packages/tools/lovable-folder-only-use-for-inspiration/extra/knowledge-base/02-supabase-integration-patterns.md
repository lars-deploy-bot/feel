# Supabase Integration Patterns

**Category:** Backend Integration  
**Priority:** CRITICAL  
**Last Updated:** 2025-10-28

---

## CRITICAL: Terminology

When talking to users:
- Use "Lovable Cloud" (NOT "Supabase")
- Say "backend" or "Cloud" for simplicity
- Only use "Supabase" in technical documentation or when user explicitly mentions it

---

## User Profiles Implementation

### Creating a Profiles Table

The Auth schema is not exposed in the auto-generated API. Create user tables in the `public` schema:

```sql
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  first_name text,
  last_name text,

  primary key (id)
);

alter table public.profiles enable row level security;
```

**CRITICAL WARNING:** Only use primary keys as foreign key references for schemas and tables like `auth.users` managed by Supabase. PostgreSQL lets you specify foreign keys for columns backed by unique indexes, but primary keys are **guaranteed not to change**.

### Auto-Update Profiles on Signup

Set up a trigger to update `public.profiles` when a user signs up:

```sql
-- inserts a row into public.profiles
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public 
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name');
  return new;
end;
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**IMPORTANT:** Do not forget the `security definer`!

**WARNING:** If the trigger fails, it could block signups. Test your code thoroughly.

---

## Realtime Updates

Supabase supports real-time updates for database tables.

### Enabling Realtime

Run these SQL commands:

```sql
-- Step 1: Use REPLICA IDENTITY FULL to capture complete row data
alter table your_table_name replica identity full;

-- Step 2: Add table to supabase_realtime publication
alter publication supabase_realtime add table your_table_name;
```

### Listening to Realtime Updates

```typescript
useEffect(() => {
  const channel = supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'table_name'
      },
      (payload) => console.log(payload)
    )
    .subscribe()   

  return () => {
    supabase.removeChannel(channel);
  }
}, []);
```

**No database-level configuration needed** - realtime functionality is built-in.

---

## Storage Buckets

### Creating Storage Buckets

Always write SQL migrations for creating and updating storage tables:

```sql
insert into storage.buckets
  (id, name, public)
values
  ('avatars', 'avatars', true);
```

### Deleting Storage Buckets

```sql
delete from storage.buckets where id = 'avatars';
```

### Storage RLS Policies

Always create correct RLS policies for buckets:

```sql
-- Example: Allow authenticated users to upload their own avatars
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Example: Allow public read access
create policy "Public avatar access"
on storage.objects for select
to public
using (bucket_id = 'avatars');
```

### Common Storage Issues

**Problem:** Images or files uploaded to a bucket don't display

**Root Cause:** Bucket isn't public

**Solution:** Check bucket configuration and update if needed:

```sql
update storage.buckets
set public = true
where id = 'avatars';
```

### CRITICAL: Storage Schema Restrictions

**DO NOT perform these actions:**
- Create custom tables in the `storage` schema
- Create custom functions in the `storage` schema
- Drop existing tables or functions in the `storage` schema
- Create indexes on existing storage tables
- Perform destructive actions on `storage.migrations`

**CORRECT: For admin access to files, create functions in public schema:**

```sql
-- CORRECT: Create function in public schema (not storage)
CREATE OR REPLACE FUNCTION public.admin_access_file(
  bucket_name TEXT,
  file_path TEXT
) 
RETURNS TABLE (
  content BYTEA,
  content_type TEXT,
  metadata JSONB
)
SECURITY DEFINER
SET search_path = public, storage
LANGUAGE plpgsql
AS $$
-- Function body
$$;
```

**For customizing storage:** Always create custom tables/functions in the `public` schema and use proper RLS policies on `storage.objects` for access control.

---

## Scheduled Functions (Cron Jobs)

To run Supabase edge functions on a schedule, enable `pg_cron` and `pg_net` extensions:

```sql
-- Enable extensions (usually done in Supabase dashboard)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create cron job
select cron.schedule(
  'invoke-function-every-minute',
  '* * * * *', -- cron expression
  $$
  select
    net.http_post(
      url:='https://project-ref.supabase.co/functions/v1/function-name',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
```

---

## Updating Tables

**CRITICAL:** Each time we modify tables (add/remove columns), we must revise code that interacts with this table:

1. Update TypeScript interfaces
2. Update RLS policies if column affects security
3. Update frontend queries
4. Update edge functions that use the table
5. Test thoroughly before deploying

---

## Related Documentation

- [Authentication Patterns](./03-authentication-patterns.md)
- [RLS Patterns](./07-rls-patterns.md)
- [Storage Patterns](./08-storage-patterns.md)
- [Edge Function Patterns](./04-edge-function-patterns.md)
