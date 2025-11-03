# Tool Workflow: Database Table Creation & Management

## Scenario
User requests: "Add a database table for [entity]" or "Store [data] in database"

## Agent Capabilities
<!-- SUPABASE DISABLED: - Backend enablement (supabase--enable) -->
- Code search (alive-search-files)
- Code writing (alive-write, alive-line-replace)
- Security scan (security--run_security_scan, security--get_security_scan_results)

## Decision Tree

```
START: User needs database storage
│
├─→ PREREQUISITES CHECK:
│   ├─→ Check useful-context: Backend enabled?
<!-- SUPABASE DISABLED: │   │   ├─→ NO: supabase--enable() -->
│   │   │   └─→ WAIT for success
│   │   └─→ YES: Continue
│   │
│   └─→ Check: Is this user-specific data?
│       ├─→ YES: Will need RLS policies
│       └─→ NO: Consider if public or admin-only
│
├─→ SCHEMA DESIGN:
│   ├─→ Identify entity relationships:
│   │   ├─→ One-to-many (user → posts)
│   │   ├─→ Many-to-many (posts ↔ tags)
│   │   └─→ One-to-one (user → profile)
│   │
│   ├─→ Determine columns:
│   │   ├─→ Primary key (id uuid)
│   │   ├─→ Foreign keys (references)
│   │   ├─→ Required fields (NOT NULL)
│   │   ├─→ Optional fields
│   │   ├─→ Timestamps (created_at, updated_at)
│   │   └─→ Soft delete? (deleted_at)
│   │
│   ├─→ Check: Does table need user_id?
│   │   ├─→ YES: Add user_id uuid REFERENCES auth.users(id)
│   │   └─→ NO: Determine ownership model
│   │
│   └─→ Plan indexes:
│       ├─→ Foreign keys need indexes
│       ├─→ Frequently queried columns
│       └─→ Composite indexes for multi-column queries
│
├─→ RLS POLICY DESIGN:
│   ├─→ IF user-owned data:
│   │   ├─→ SELECT: WHERE auth.uid() = user_id
│   │   ├─→ INSERT: WITH CHECK (auth.uid() = user_id)
│   │   ├─→ UPDATE: WHERE auth.uid() = user_id
│   │   └─→ DELETE: WHERE auth.uid() = user_id
│   │
│   ├─→ IF public read, private write:
│   │   ├─→ SELECT: true (everyone can read)
│   │   ├─→ INSERT: WITH CHECK (auth.uid() = user_id)
│   │   ├─→ UPDATE: WHERE auth.uid() = user_id
│   │   └─→ DELETE: WHERE auth.uid() = user_id
│   │
│   ├─→ IF role-based:
│   │   └─→ Need has_role() function + user_roles table
│   │
│   └─→ IF organization-based:
│       └─→ Check organization_id IN (user's orgs)
│
├─→ PROVIDE SQL TO USER:
│   ├─→ Generate complete SQL:
│   │   1. CREATE TABLE statement
│   │   2. ALTER TABLE ENABLE RLS
│   │   3. CREATE POLICY statements (all operations)
│   │   4. CREATE INDEX statements
│   │   5. Trigger for updated_at (if applicable)
│   │   6. Trigger for auto-populate (if applicable)
│   │
<!-- SUPABASE DISABLED: │   └─→ CRITICAL: Explain this must be run in Supabase dashboard -->
│
└─→ CLIENT IMPLEMENTATION:
    ├─→ Create TypeScript types
    ├─→ Create database hooks
    ├─→ Create UI components
    └─→ Update routes if needed
```

## Tool Sequences

### Sequence 1: Simple User-Owned Table
Request: "Add a notes table so users can save notes"

```
1. Check: Backend enabled?
<!-- SUPABASE DISABLED:    ├─→ NO: supabase--enable() → WAIT -->
   └─→ YES: Continue

2. Generate SQL (provide to user):
   ```sql
   CREATE TABLE notes (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
     title text NOT NULL,
     content text,
     created_at timestamptz DEFAULT now() NOT NULL,
     updated_at timestamptz DEFAULT now() NOT NULL
   );
   
   ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view own notes"
     ON notes FOR SELECT USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can create own notes"
     ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
   
   CREATE POLICY "Users can update own notes"
     ON notes FOR UPDATE USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can delete own notes"
     ON notes FOR DELETE USING (auth.uid() = user_id);
   
   CREATE INDEX idx_notes_user_id ON notes(user_id);
   ```

3. Implementation (parallel):
   alive-write(src/types/database.ts) ||
   alive-write(src/hooks/useNotes.ts) ||
   alive-write(src/components/NotesList.tsx) ||
   alive-write(src/components/NoteEditor.tsx)

4. Routes:
   alive-line-replace(src/App.tsx, add-notes-route)
```

### Sequence 2: Public Read, Private Write
Request: "Add a blog posts table"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->

2. SQL for user (includes public read policy):
   ```sql
   CREATE TABLE posts (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id) NOT NULL,
     title text NOT NULL,
     content text NOT NULL,
     status text DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
     published_at timestamptz,
     created_at timestamptz DEFAULT now() NOT NULL,
     updated_at timestamptz DEFAULT now() NOT NULL
   );
   
   ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Anyone can view published posts"
     ON posts FOR SELECT 
     USING (status = 'published' OR auth.uid() = user_id);
   
   CREATE POLICY "Users can create own posts"
     ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
   
   CREATE POLICY "Users can update own posts"
     ON posts FOR UPDATE USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can delete own posts"
     ON posts FOR DELETE USING (auth.uid() = user_id);
   
   CREATE INDEX idx_posts_user_id ON posts(user_id);
   CREATE INDEX idx_posts_status ON posts(status);
   ```

3. Implementation:
   alive-write(src/hooks/usePosts.ts) ||
   alive-write(src/pages/Blog.tsx) ||
   alive-write(src/components/PostCard.tsx)
```

### Sequence 3: Role-Based Access Table
Request: "Add an admin-only settings table"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->

2. Check: user_roles table exists?
   ├─→ alive-search-files("user_roles", "**/*.sql")
   └─→ IF NOT: Provide user_roles setup first

3. SQL with role-based RLS:
   ```sql
   CREATE TABLE app_settings (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     key text UNIQUE NOT NULL,
     value jsonb NOT NULL,
     updated_by uuid REFERENCES auth.users(id),
     updated_at timestamptz DEFAULT now() NOT NULL
   );
   
   ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Only admins can view settings"
     ON app_settings FOR SELECT
     USING (public.has_role(auth.uid(), 'admin'));
   
   CREATE POLICY "Only admins can modify settings"
     ON app_settings FOR ALL
     USING (public.has_role(auth.uid(), 'admin'));
   ```

4. Implementation:
   alive-write(src/hooks/useSettings.ts) ||
   alive-write(src/pages/AdminSettings.tsx)
```

### Sequence 4: Many-to-Many Relationship
Request: "Let users tag their posts"

```
1. Three tables needed: posts, tags, post_tags

2. SQL for all three tables:
   ```sql
   -- Tags table
   CREATE TABLE tags (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name text UNIQUE NOT NULL,
     created_at timestamptz DEFAULT now()
   );
   
   -- Junction table
   CREATE TABLE post_tags (
     post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
     tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
     PRIMARY KEY (post_id, tag_id)
   );
   
   -- RLS policies
   ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
   ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Tags are viewable by everyone"
     ON tags FOR SELECT USING (true);
   
   CREATE POLICY "Post tags inherit post permissions"
     ON post_tags FOR SELECT
     USING (
       post_id IN (
         SELECT id FROM posts WHERE status = 'published' OR auth.uid() = user_id
       )
     );
   
   -- Indexes
   CREATE INDEX idx_post_tags_post_id ON post_tags(post_id);
   CREATE INDEX idx_post_tags_tag_id ON post_tags(tag_id);
   ```

3. Implementation:
   alive-write(src/hooks/useTags.ts) ||
   alive-write(src/components/TagSelector.tsx) ||
   alive-line-replace(src/hooks/usePosts.ts, include-tags-in-query)
```

### Sequence 5: Trigger-Based Auto-Population
Request: "Create user profiles automatically on signup"

```
1. SQL with trigger:
   ```sql
   -- Profiles table
   CREATE TABLE profiles (
     id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     email text,
     full_name text,
     avatar_url text,
     created_at timestamptz DEFAULT now() NOT NULL,
     updated_at timestamptz DEFAULT now() NOT NULL
   );
   
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Profiles are viewable by everyone"
     ON profiles FOR SELECT USING (true);
   
   CREATE POLICY "Users can update own profile"
     ON profiles FOR UPDATE USING (auth.uid() = id);
   
   -- Trigger function
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY DEFINER SET search_path = public
   AS $$
   BEGIN
     INSERT INTO public.profiles (id, email, full_name)
     VALUES (
       new.id,
       new.email,
       new.raw_user_meta_data->>'full_name'
     );
     RETURN new;
   END;
   $$;
   
   -- Trigger
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

2. Implementation:
   alive-write(src/hooks/useProfile.ts) ||
   alive-write(src/pages/Profile.tsx)
```

### Sequence 6: Soft Delete Pattern
Request: "Let users archive posts instead of deleting them"

```
1. SQL with soft delete:
   ```sql
   ALTER TABLE posts ADD COLUMN deleted_at timestamptz;
   
   CREATE INDEX idx_posts_deleted_at ON posts(deleted_at)
   WHERE deleted_at IS NULL;
   
   -- Update RLS to exclude soft-deleted
   DROP POLICY "Anyone can view published posts" ON posts;
   
   CREATE POLICY "Anyone can view published non-deleted posts"
     ON posts FOR SELECT
     USING (
       deleted_at IS NULL 
       AND (status = 'published' OR auth.uid() = user_id)
     );
   ```

2. Update frontend:
   alive-line-replace(src/hooks/usePosts.ts, add-soft-delete-logic)
```

### Sequence 7: Complex Query Requirements
Request: "Add full-text search to posts"

```
1. SQL with search:
   ```sql
   ALTER TABLE posts ADD COLUMN search_vector tsvector;
   
   CREATE INDEX idx_posts_search 
   ON posts USING GIN(search_vector);
   
   CREATE OR REPLACE FUNCTION posts_search_trigger()
   RETURNS trigger AS $$
   BEGIN
     new.search_vector := 
       setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(new.content, '')), 'B');
     RETURN new;
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER posts_search_update
   BEFORE INSERT OR UPDATE ON posts
   FOR EACH ROW EXECUTE FUNCTION posts_search_trigger();
   ```

2. Implementation:
   alive-line-replace(src/hooks/usePosts.ts, add-search-method)
   alive-write(src/components/PostSearch.tsx)
```

### Sequence 8: JSON Column Usage
Request: "Store flexible metadata for posts"

```
1. SQL with JSONB:
   ```sql
   ALTER TABLE posts ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
   
   CREATE INDEX idx_posts_metadata ON posts USING GIN(metadata);
   
   -- Example: Query by JSON field
   -- SELECT * FROM posts WHERE metadata->>'featured' = 'true';
   ```

2. Implementation:
   alive-line-replace(src/types/database.ts, add-metadata-type)
   alive-line-replace(src/hooks/usePosts.ts, handle-metadata)
```

### Sequence 9: Security Audit After Creation
Request: "Make sure my database is secure"

```
1. security--run_security_scan()
2. WAIT for scan completion
3. security--get_security_scan_results(force=true)
4. Analyze results:
   ├─→ Missing RLS? Provide SQL to fix
   ├─→ Weak policies? Suggest improvements
   └─→ Exposed data? Show how to restrict
5. IF issues found:
   └─→ security--manage_security_finding(operations=[...])
```

### Sequence 10: Migration for Existing Table
Request: "Add a 'priority' column to my existing tasks table"

```
1. alive-search-files("tasks", "src/**")
2. Determine: What exists already?
3. SQL for migration:
   ```sql
   BEGIN;
   
   ALTER TABLE tasks 
   ADD COLUMN priority text DEFAULT 'medium'
   CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
   
   CREATE INDEX idx_tasks_priority ON tasks(priority);
   
   COMMIT;
   ```

4. Update types and hooks:
   alive-line-replace(src/types/database.ts, add-priority-field) ||
   alive-line-replace(src/hooks/useTasks.ts, handle-priority)
```

## Critical Rules

1. **Backend must be enabled first** - No exceptions
2. **Always provide SQL to user** - Agent cannot execute SQL
3. **RLS must be enabled** - Every user-accessible table needs RLS
4. **Include all CRUD policies** - SELECT, INSERT, UPDATE, DELETE
5. **Add indexes for foreign keys** - Performance requirement
6. **Use SECURITY DEFINER for helper functions** - Avoid RLS recursion
7. **Timestamps are standard** - created_at, updated_at on most tables
<!-- SUPABASE DISABLED: 8. **Never store sensitive data unencrypted** - Use Supabase vault if needed -->

## Common Mistakes

❌ Not enabling backend before providing SQL
❌ Forgetting to enable RLS on tables
❌ Missing policies for some operations
❌ Not adding indexes on foreign keys
❌ Using circular references in RLS policies
❌ Storing roles on profiles table (use separate user_roles)
❌ Not using SECURITY DEFINER for role check functions
❌ Forgetting updated_at triggers
❌ Not providing complete SQL (missing indexes, policies)
❌ Assuming agent can execute SQL (it cannot)
