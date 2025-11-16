# RLS (Row Level Security) Error Patterns

## Complete Guide to RLS Violations & Fixes

RLS errors are the most common backend issues in Lovable projects. This guide provides instant solutions.

---

## Understanding RLS Errors

**What is RLS?**
Row Level Security controls which rows users can access in database tables. Without proper policies, users get permission errors.

**Common Error Messages:**
- `new row violates row-level security policy`
- `permission denied for table X`
- `insufficient privileges`
- `42501: new row violates row-level security policy for table "X"`

---

## Error 1: Insert Blocked

### Error Message
```
new row violates row-level security policy for table "posts"
```

### Cause
No INSERT policy exists or policy conditions not met.

### Solution
```sql
-- Check current policies
SELECT * FROM pg_policies WHERE tablename = 'posts';

-- Add INSERT policy
CREATE POLICY "Users can insert their own posts"
ON posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

**Key Points:**
- `FOR INSERT` specifies policy type
- `TO authenticated` applies to logged-in users only
- `WITH CHECK` defines the condition that must be true

---

## Error 2: Select Blocked (Can't Read Data)

### Error Message
```
permission denied for table "profiles"
```

### Cause
No SELECT policy exists.

### Solution
```sql
-- Allow users to read all profiles (public data)
CREATE POLICY "Profiles are viewable by everyone"
ON profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Or restrict to own profile only
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
```

**Policy Patterns:**

| Use Case | USING Clause |
|----------|--------------|
| Public read | `true` |
| Own records only | `auth.uid() = user_id` |
| Team members | `user_id IN (SELECT user_id FROM team_members WHERE team_id = (SELECT team_id FROM users WHERE id = auth.uid()))` |
| Published only | `status = 'published'` |

---

## Error 3: Update Blocked

### Error Message
```
new row violates row-level security policy (policy "X" not satisfied)
```

### Cause
UPDATE policy missing or conditions not met.

### Solution
```sql
-- Allow users to update their own records
CREATE POLICY "Users can update own posts"
ON posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)  -- Can only update if you own it
WITH CHECK (auth.uid() = user_id);  -- Can only update to values where you still own it
```

**USING vs WITH CHECK:**
- `USING`: Which rows can be selected for update (before update)
- `WITH CHECK`: Which values can be written (after update)

---

## Error 4: Delete Blocked

### Error Message
```
permission denied for table "comments"
```

### Cause
No DELETE policy exists.

### Solution
```sql
-- Allow users to delete their own comments
CREATE POLICY "Users can delete own comments"
ON comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

---

## Error 5: RLS Infinite Recursion

### Error Message
```
infinite recursion detected in policy for relation "users"
```

### Cause
Policy references the same table it's protecting, creating a loop.

### Example of Problem
```sql
-- ❌ WRONG - Causes infinite recursion
CREATE POLICY "Users can view team members"
ON users
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT member_id 
    FROM team_members 
    WHERE team_id = (
      SELECT team_id  -- This queries users table again!
      FROM users 
      WHERE id = auth.uid()
    )
  )
);
```

### Solution 1: Use Security Definer Function
```sql
-- Create function that bypasses RLS
CREATE OR REPLACE FUNCTION get_user_team_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER  -- Runs with elevated privileges
AS $$
  SELECT team_id FROM users WHERE id = user_id;
$$;

-- Use function in policy
CREATE POLICY "Users can view team members"
ON users
FOR SELECT
TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
);
```

### Solution 2: Store in JWT Claims
```sql
-- In trigger or application code, set JWT claim
-- Then use in policy:
CREATE POLICY "Users can view team members"
ON users
FOR SELECT
TO authenticated
USING (
  team_id = (current_setting('request.jwt.claims', true)::json->>'team_id')::uuid
);
```

### Solution 3: Denormalize Data
```sql
-- Add team_id to separate table without RLS
CREATE TABLE user_teams (
  user_id uuid PRIMARY KEY,
  team_id uuid
);

-- No RLS on user_teams
ALTER TABLE user_teams DISABLE ROW LEVEL SECURITY;

-- Policy uses simple lookup
CREATE POLICY "Users can view team members"
ON users
FOR SELECT
TO authenticated
USING (
  team_id = (SELECT team_id FROM user_teams WHERE user_id = auth.uid())
);
```

---

## Error 6: Policy Order Conflicts

### Error Message
```
No policy found for operation
```

### Cause
Multiple policies exist but none allow the operation (policies are OR'd together, but all must be considered).

### Solution
```sql
-- Check all policies for table
SELECT * FROM pg_policies WHERE tablename = 'posts';

-- Drop conflicting policy
DROP POLICY "old_policy_name" ON posts;

-- Create correct policy
CREATE POLICY "correct_policy"
ON posts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## Error 7: Missing Policy for Service Role

### Error Message
```
Edge function can't insert: permission denied
```

### Cause
Edge functions using service role client still need policies for authenticated operations.

### Solution
```typescript
// ❌ Wrong - Using authenticated client without proper RLS
const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_ANON_KEY')
);

// ✅ Correct - Use service role to bypass RLS
const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

// Or add policy for authenticated operations
```

---

## Error 8: Wrong Role in Policy

### Error Message
```
Operation works in SQL editor but fails in app
```

### Cause
Policy specifies wrong role.

### Solution
```sql
-- ❌ Wrong - postgres role (only for SQL editor)
CREATE POLICY "..." ON posts TO postgres USING (true);

-- ✅ Correct - authenticated role (for app users)
CREATE POLICY "..." ON posts TO authenticated USING (true);

-- ✅ Correct - anon role (for non-logged-in users)
CREATE POLICY "..." ON posts TO anon USING (true);

-- ✅ Correct - both roles
CREATE POLICY "..." ON posts TO authenticated, anon USING (true);
```

**Role Reference:**
- `postgres`: Superuser role (SQL editor only)
- `authenticated`: Logged-in users
- `anon`: Anonymous users (not logged in)
- `service_role`: Service role (edge functions with service key)

---

## Error 9: NULL auth.uid() in Policy

### Error Message
```
All operations fail with RLS enabled
```

### Cause
`auth.uid()` returns NULL because user not authenticated.

### Solution
```sql
-- Check if auth.uid() is NULL
SELECT auth.uid();  -- Run in SQL editor while logged in

-- Add fallback for anonymous users
CREATE POLICY "Public read, authenticated write"
ON posts
FOR SELECT
TO authenticated, anon
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN status = 'published'  -- Anon users see published only
    ELSE true  -- Authenticated users see all
  END
);
```

---

## Error 10: Foreign Key RLS Cascade Issues

### Error Message
```
insert or update on table "comments" violates foreign key constraint
```

### Cause
Referenced table has RLS that blocks access to the foreign key.

### Solution
```sql
-- Ensure SELECT policy exists on referenced table
CREATE POLICY "Posts are viewable for FK checks"
ON posts
FOR SELECT
TO authenticated
USING (true);  -- Or more restrictive based on needs

-- Then comments can reference posts
```

---

## RLS Debugging Workflow

### Step 1: Verify RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
-- rowsecurity should be true
```

### Step 2: Check Existing Policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

### Step 3: Test Policy Logic
```sql
-- Test as specific user
SET request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Try operation
SELECT * FROM your_table;
INSERT INTO your_table VALUES (...);
```

### Step 4: Temporarily Disable RLS (Debug Only)
```sql
-- DANGER: Only for testing!
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;

-- Test if operations work without RLS
-- If they do, it's a policy issue

-- Re-enable
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

### Step 5: Check auth.uid()
```sql
SELECT auth.uid();  -- Should return your user UUID when logged in
```

---

## Common RLS Policy Templates

### Template 1: User-Owned Records
```sql
-- Full CRUD on own records
CREATE POLICY "users_own_records"
ON table_name
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Template 2: Public Read, Auth Write
```sql
-- Anyone can read, logged-in users can write
CREATE POLICY "public_read"
ON table_name
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "auth_write"
ON table_name
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### Template 3: Team/Organization Access
```sql
-- Users in same org can access records
CREATE POLICY "org_access"
ON table_name
FOR ALL
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM user_orgs 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id 
    FROM user_orgs 
    WHERE user_id = auth.uid()
  )
);
```

### Template 4: Admin Override
```sql
-- Normal users see own records, admins see all
CREATE POLICY "user_or_admin_access"
ON table_name
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);
```

---

## Prevention Checklist

When creating new tables:

- [ ] Enable RLS: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- [ ] Create SELECT policy (read access)
- [ ] Create INSERT policy (write access)
- [ ] Create UPDATE policy (modify access)
- [ ] Create DELETE policy (remove access)
- [ ] Test with authenticated user
- [ ] Test with anonymous user
- [ ] Test edge cases (null values, foreign keys)
- [ ] Document policy logic in comments
- [ ] Avoid infinite recursion (no self-referencing queries)

---

## Quick Reference: RLS SQL Commands

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Disable RLS (not recommended in production)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- View all policies for a table
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Drop a policy
DROP POLICY "policy_name" ON table_name;

-- Create policy (template)
CREATE POLICY "policy_name"
ON table_name
FOR [SELECT | INSERT | UPDATE | DELETE | ALL]
TO [authenticated | anon | postgres | role_name]
USING (condition_for_existing_rows)
WITH CHECK (condition_for_new_rows);
```

---

## When to Use Service Role (Bypass RLS)

Use service role key in edge functions when:
- ✅ Performing admin operations
- ✅ Background jobs that don't belong to specific users
- ✅ System-level operations
- ✅ Analytics aggregations

Don't use service role when:
- ❌ User-initiated operations
- ❌ Could be done with proper RLS policies
- ❌ Data belongs to specific user
- ❌ Security requirements demand user context

Remember: RLS policies are your friend. They enforce data security at the database level, making your app more secure by default.
