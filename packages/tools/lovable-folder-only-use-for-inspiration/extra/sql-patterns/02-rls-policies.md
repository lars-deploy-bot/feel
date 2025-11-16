# RLS Policy Library

## Complete Collection of Row Level Security Patterns

Pre-built, battle-tested RLS policies for common use cases.

---

## Basic Policy Patterns

### 1. User Owns Record
```sql
-- User can only access their own records
CREATE POLICY "users_own_records"
ON table_name
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### 2. Public Read, User Write
```sql
-- Anyone can read, only owner can write
CREATE POLICY "public_read"
ON table_name
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "user_write"
ON table_name
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_update_own"
ON table_name
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_delete_own"
ON table_name
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

### 3. Published Content Only (Public)
```sql
-- Public can only see published content
CREATE POLICY "published_content"
ON posts
FOR SELECT
TO authenticated, anon
USING (status = 'published' OR auth.uid() = author_id);

-- Authors can see their drafts too
CREATE POLICY "author_sees_all"
ON posts
FOR SELECT
TO authenticated
USING (auth.uid() = author_id);
```

---

## Team/Organization Patterns

### 4. Organization Members
```sql
-- Users in same org can access records
CREATE POLICY "org_members_access"
ON table_name
FOR ALL
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM user_organizations 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id 
    FROM user_organizations 
    WHERE user_id = auth.uid()
  )
);
```

### 5. Team Membership with Roles
```sql
-- Different access based on team role
CREATE POLICY "team_read_access"
ON projects
FOR SELECT
TO authenticated
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "team_admin_write"
ON projects
FOR INSERT, UPDATE, DELETE
TO authenticated
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);
```

### 6. Workspace with Invitations
```sql
-- Members + invited users can access
CREATE POLICY "workspace_access"
ON documents
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
  OR
  id IN (
    SELECT document_id FROM document_invites WHERE email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);
```

---

## Role-Based Access Control

### 7. Admin Override
```sql
-- Admins can access everything, users only own records
CREATE POLICY "admin_or_owner"
ON table_name
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### 8. Multi-Level Roles
```sql
-- Different access levels
CREATE POLICY "role_based_read"
ON sensitive_data
FOR SELECT
TO authenticated
USING (
  CASE 
    WHEN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') 
      THEN true
    WHEN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager')
      THEN department_id IN (SELECT department_id FROM users WHERE id = auth.uid())
    ELSE
      auth.uid() = user_id
  END
);
```

### 9. Service Accounts
```sql
-- Special accounts with elevated permissions
CREATE POLICY "service_account_access"
ON table_name
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM service_accounts 
    WHERE service_accounts.user_id = auth.uid()
    AND service_accounts.has_access_to_table = 'table_name'
  )
);
```

---

## Hierarchical Access Patterns

### 10. Manager Sees Team Records
```sql
-- Managers see their direct reports' records
CREATE POLICY "manager_team_access"
ON employee_records
FOR SELECT
TO authenticated
USING (
  auth.uid() = employee_id
  OR
  auth.uid() IN (
    SELECT manager_id FROM employees WHERE id = employee_id
  )
);
```

### 11. Nested Organizations
```sql
-- Parent org admins can access child org data
CREATE POLICY "nested_org_access"
ON org_data
FOR SELECT
TO authenticated
USING (
  org_id IN (
    WITH RECURSIVE org_tree AS (
      SELECT id FROM organizations WHERE id IN (
        SELECT org_id FROM user_org_roles WHERE user_id = auth.uid()
      )
      UNION
      SELECT o.id FROM organizations o
      INNER JOIN org_tree ot ON o.parent_org_id = ot.id
    )
    SELECT id FROM org_tree
  )
);
```

---

## Time-Based Policies

### 12. Scheduled Publishing
```sql
-- Content visible after publish date
CREATE POLICY "scheduled_content"
ON articles
FOR SELECT
TO authenticated, anon
USING (
  (published_at IS NOT NULL AND published_at <= now())
  OR
  auth.uid() = author_id
);
```

### 13. Expiring Access
```sql
-- Access expires after certain date
CREATE POLICY "expiring_access"
ON subscriptions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND (expires_at IS NULL OR expires_at > now())
);
```

### 14. Trial Period
```sql
-- Free tier with usage limits based on time
CREATE POLICY "trial_access"
ON premium_features
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    subscription_type = 'premium'
    OR
    (created_at > now() - interval '14 days' AND usage_count < 100)
  )
);
```

---

## Shared/Collaborative Access

### 15. Shared Documents
```sql
-- Owner or explicitly shared users can access
CREATE POLICY "shared_documents"
ON documents
FOR ALL
TO authenticated
USING (
  owner_id = auth.uid()
  OR
  id IN (
    SELECT document_id FROM document_shares WHERE user_id = auth.uid()
  )
);
```

### 16. Collaborative Editing
```sql
-- Multiple users can edit same document
CREATE POLICY "collaborative_edit"
ON documents
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR
  id IN (
    SELECT document_id FROM collaborators 
    WHERE user_id = auth.uid() AND permission IN ('read', 'write')
  )
);

CREATE POLICY "collaborative_write"
ON documents
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR
  id IN (
    SELECT document_id FROM collaborators 
    WHERE user_id = auth.uid() AND permission = 'write'
  )
);
```

### 17. Public Share Link
```sql
-- Anyone with link can access
CREATE POLICY "public_share_link"
ON shared_content
FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  auth.uid() = owner_id
);
```

---

## Status-Based Policies

### 18. Workflow States
```sql
-- Different access based on approval status
CREATE POLICY "workflow_access"
ON requests
FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid()
  OR
  (status = 'pending' AND auth.uid() IN (
    SELECT user_id FROM approvers WHERE role = 'reviewer'
  ))
  OR
  (status = 'approved' AND is_public = true)
);
```

### 19. Draft vs Published
```sql
-- Drafts only visible to author, published to all
CREATE POLICY "draft_published"
ON blog_posts
FOR SELECT
TO authenticated, anon
USING (
  status = 'published'
  OR
  (status = 'draft' AND auth.uid() = author_id)
);
```

---

## Foreign Key Policies

### 20. Related Records
```sql
-- User can access records related to their owned parent
CREATE POLICY "related_records"
ON comments
FOR SELECT
TO authenticated
USING (
  post_id IN (
    SELECT id FROM posts WHERE author_id = auth.uid()
  )
  OR
  author_id = auth.uid()
);
```

### 21. Nested Permissions
```sql
-- Access to child if you have access to parent
CREATE POLICY "nested_permissions"
ON tasks
FOR ALL
TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects WHERE team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  )
);
```

---

## Special Cases

### 22. Read-Only Table
```sql
-- Everyone can read, only system can write
CREATE POLICY "read_only_public"
ON reference_data
FOR SELECT
TO authenticated, anon
USING (true);

-- No INSERT/UPDATE/DELETE policies = only postgres/service role can modify
```

### 23. Audit Log (Write-Only)
```sql
-- Users can write audit logs but not read others'
CREATE POLICY "audit_write"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "audit_read_own"
ON audit_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can read all
CREATE POLICY "audit_admin_read"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### 24. Rate Limiting via RLS
```sql
-- Limit inserts per user per time period
CREATE POLICY "rate_limit_insert"
ON api_requests
FOR INSERT
TO authenticated
WITH CHECK (
  (
    SELECT COUNT(*) FROM api_requests 
    WHERE user_id = auth.uid() 
    AND created_at > now() - interval '1 hour'
  ) < 100 -- Max 100 requests per hour
);
```

---

## Security Functions (Helpers)

### Check if User is Admin
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Use in policies
CREATE POLICY "admin_access"
ON sensitive_table
FOR ALL
TO authenticated
USING (is_admin());
```

### Get User's Organizations
```sql
CREATE OR REPLACE FUNCTION user_organizations()
RETURNS SETOF uuid AS $$
  SELECT org_id FROM user_orgs WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Use in policies
CREATE POLICY "org_access"
ON org_data
FOR ALL
TO authenticated
USING (org_id IN (SELECT user_organizations()));
```

### Check Permission
```sql
CREATE OR REPLACE FUNCTION has_permission(
  resource_type text,
  resource_id uuid,
  required_permission text
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
    AND resource_type = $1
    AND resource_id = $2
    AND permission = $3
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Use in policies
CREATE POLICY "permission_based_access"
ON resources
FOR ALL
TO authenticated
USING (has_permission('resource', id, 'read'));
```

---

## Policy Management Commands

```sql
-- View all policies for a table
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Drop a policy
DROP POLICY "policy_name" ON table_name;

-- Disable RLS temporarily (testing only!)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'your_table';
```

---

## Policy Testing

```sql
-- Test as specific user (in SQL editor)
SET request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Test operations
SELECT * FROM table_name; -- Should respect RLS
INSERT INTO table_name VALUES (...); -- Should check WITH CHECK
UPDATE table_name SET ...;
DELETE FROM table_name WHERE ...;

-- Reset to postgres role
RESET request.jwt.claims;
```

---

## Best Practices

1. **Start restrictive, open up as needed**
   - Begin with no access, add policies to grant access
   
2. **Use SECURITY DEFINER functions for complex logic**
   - Avoid infinite recursion by extracting logic to functions

3. **Test with actual user tokens**
   - SQL editor runs as postgres, not as authenticated users

4. **Document your policies**
   - Add comments explaining the access logic

5. **Use consistent naming**
   - `table_action_condition` (e.g., `users_select_own`)

6. **Consider performance**
   - Complex policies with subqueries can be slow
   - Add indexes on columns used in policies

7. **Separate read and write policies**
   - Easier to reason about and maintain

8. **Use roles effectively**
   - `authenticated` for logged-in users
   - `anon` for public access
   - Don't use `postgres` role in policies (SQL editor only)

Remember: RLS policies are your first line of defense. They run at the database level and cannot be bypassed by client code.
