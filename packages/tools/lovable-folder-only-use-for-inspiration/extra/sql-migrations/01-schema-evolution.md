# Database Schema Evolution

## Managing Schema Changes Over Time

This document covers patterns for evolving database schemas in Lovable projects using Supabase migrations.

---

## Schema Evolution Principles

### 1. Never Break Existing Code

```sql
-- ❌ BAD: Breaking change
ALTER TABLE users DROP COLUMN email;

-- ✅ GOOD: Non-breaking evolution
ALTER TABLE users ADD COLUMN email_verified boolean DEFAULT false;
```

### 2. Always Use Migrations

```sql
-- ❌ BAD: Manual changes in SQL editor
-- (No record of what changed, when, or why)

-- ✅ GOOD: Version-controlled migration
-- migrations/20250114_add_user_profiles.sql
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);
```

### 3. Make Changes Backwards Compatible

```sql
-- ❌ BAD: Immediate column rename
ALTER TABLE posts RENAME COLUMN body TO content;

-- ✅ GOOD: Gradual migration
-- Step 1: Add new column
ALTER TABLE posts ADD COLUMN content text;

-- Step 2: Copy data
UPDATE posts SET content = body WHERE content IS NULL;

-- Step 3: Update application to use new column
-- (Deploy code changes)

-- Step 4: (Later migration) Drop old column
-- ALTER TABLE posts DROP COLUMN body;
```

---

## Common Schema Changes

### Adding a Column

```sql
-- migrations/20250114_001_add_user_bio.sql

-- Add column with default value (non-breaking)
ALTER TABLE profiles 
ADD COLUMN bio text DEFAULT '';

-- Add NOT NULL column safely
ALTER TABLE profiles 
ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add column with check constraint
ALTER TABLE users
ADD COLUMN age integer CHECK (age >= 13 AND age <= 120);
```

### Adding a Table

```sql
-- migrations/20250114_002_create_posts_table.sql

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_published ON posts(published) WHERE published = true;

-- Add RLS policies
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read published posts"
  ON posts FOR SELECT
  USING (published = true);

CREATE POLICY "Users can manage own posts"
  ON posts FOR ALL
  USING (auth.uid() = user_id);
```

### Renaming a Column (Safe Pattern)

```sql
-- migrations/20250114_003_rename_body_to_content.sql

-- Phase 1: Add new column
ALTER TABLE posts ADD COLUMN content text;

-- Phase 2: Copy data
UPDATE posts SET content = body WHERE content IS NULL;

-- Phase 3: (After application updated) Drop old column
-- This should be a SEPARATE migration run later
-- ALTER TABLE posts DROP COLUMN body;
```

### Changing Column Type

```sql
-- migrations/20250114_004_change_price_to_decimal.sql

-- ❌ RISKY: Direct type change may fail with data
-- ALTER TABLE products ALTER COLUMN price TYPE decimal(10,2);

-- ✅ SAFE: Multi-step migration
-- Step 1: Add new column
ALTER TABLE products ADD COLUMN price_decimal decimal(10,2);

-- Step 2: Convert data
UPDATE products 
SET price_decimal = CAST(price AS decimal(10,2))
WHERE price_decimal IS NULL;

-- Step 3: Make new column NOT NULL
ALTER TABLE products ALTER COLUMN price_decimal SET NOT NULL;

-- Step 4: (Later) Drop old column and rename
-- ALTER TABLE products DROP COLUMN price;
-- ALTER TABLE products RENAME COLUMN price_decimal TO price;
```

### Adding Foreign Keys

```sql
-- migrations/20250114_005_add_category_fk.sql

-- Add foreign key to new column
ALTER TABLE posts 
ADD COLUMN category_id uuid REFERENCES categories(id);

-- Add foreign key to existing column (risky - validate data first)
DO $$
BEGIN
  -- Check for orphaned records
  IF NOT EXISTS (
    SELECT 1 FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id IS NOT NULL AND c.id IS NULL
  ) THEN
    -- Safe to add constraint
    ALTER TABLE posts 
    ADD CONSTRAINT fk_posts_category 
    FOREIGN KEY (category_id) REFERENCES categories(id);
  ELSE
    RAISE EXCEPTION 'Cannot add foreign key: orphaned records exist';
  END IF;
END $$;
```

---

## Migration Patterns

### Pattern 1: Add Column with Default

```sql
-- Safe for existing data
ALTER TABLE users 
ADD COLUMN newsletter_subscribed boolean DEFAULT false;

-- Existing rows get DEFAULT value automatically
-- New rows can explicitly set value
```

### Pattern 2: Add Column Without Default

```sql
-- For optional data
ALTER TABLE profiles 
ADD COLUMN website_url text;

-- Existing rows get NULL
-- Application must handle NULL gracefully
```

### Pattern 3: Add NOT NULL Column

```sql
-- Step 1: Add nullable column
ALTER TABLE users ADD COLUMN timezone text;

-- Step 2: Populate existing rows
UPDATE users SET timezone = 'UTC' WHERE timezone IS NULL;

-- Step 3: Make NOT NULL
ALTER TABLE users ALTER COLUMN timezone SET NOT NULL;
```

### Pattern 4: Drop Column (Safe)

```sql
-- Step 1: Remove from application code (deploy)
-- (Users no longer read/write this column)

-- Step 2: (After confirming no errors) Drop column
ALTER TABLE users DROP COLUMN IF EXISTS deprecated_field;
```

### Pattern 5: Rename Table

```sql
-- Step 1: Create view with new name
CREATE VIEW new_table_name AS SELECT * FROM old_table_name;

-- Step 2: Update application to use new name (deploy)

-- Step 3: (Later) Rename actual table
ALTER TABLE old_table_name RENAME TO new_table_name;

-- Step 4: Drop view
DROP VIEW IF EXISTS new_table_name;
```

---

## Data Backfilling

### Backfill Pattern

```sql
-- migrations/20250114_006_backfill_user_roles.sql

-- Add column
ALTER TABLE users ADD COLUMN role text DEFAULT 'user';

-- Backfill data based on logic
UPDATE users 
SET role = 'admin' 
WHERE email IN (
  SELECT email FROM admin_emails
);

UPDATE users 
SET role = 'moderator'
WHERE created_at < '2024-01-01' 
  AND posts_count > 100;

-- Make NOT NULL after backfill
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
```

### Batch Backfill for Large Tables

```sql
-- For tables with millions of rows
DO $$
DECLARE
  batch_size INTEGER := 10000;
  rows_updated INTEGER;
BEGIN
  LOOP
    -- Update in batches
    UPDATE users 
    SET role = 'user'
    WHERE role IS NULL
      AND id IN (
        SELECT id FROM users 
        WHERE role IS NULL 
        LIMIT batch_size
      );
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    -- Exit when no more rows to update
    EXIT WHEN rows_updated = 0;
    
    -- Log progress
    RAISE NOTICE 'Updated % rows', rows_updated;
    
    -- Slight delay to avoid overwhelming DB
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

---

## Schema Validation

### Check Before Migration

```sql
-- Validate no orphaned foreign keys
SELECT p.id, p.user_id
FROM posts p
LEFT JOIN profiles pr ON p.user_id = pr.id
WHERE pr.id IS NULL;

-- Validate no NULL values before adding NOT NULL
SELECT COUNT(*) 
FROM users 
WHERE email IS NULL;

-- Validate data type conversion
SELECT id, price
FROM products
WHERE price IS NOT NULL 
  AND price !~ '^[0-9]+(\.[0-9]{1,2})?$';
```

---

## Rollback Strategy

### Reversible Migrations

```sql
-- migrations/20250114_007_add_tags_table.sql
-- UP
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- migrations/20250114_007_rollback_add_tags_table.sql
-- DOWN (rollback script)
DROP TABLE IF EXISTS tags;
```

### Checkpoint Before Risky Change

```sql
-- Create backup before major change
CREATE TABLE users_backup_20250114 AS SELECT * FROM users;

-- Perform migration
ALTER TABLE users ADD COLUMN new_field text;

-- If needed, restore from backup
-- TRUNCATE users;
-- INSERT INTO users SELECT * FROM users_backup_20250114;
```

---

## Testing Migrations Locally

### Test Environment Setup

```sql
-- 1. Create test database
CREATE DATABASE myapp_test;

-- 2. Run migrations on test DB
\c myapp_test
\i migrations/20250114_001_add_user_bio.sql

-- 3. Test with sample data
INSERT INTO profiles (id, display_name, bio) 
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'Test User', 'Test bio');

-- 4. Verify schema
\d profiles

-- 5. Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

---

## Migration Best Practices

### 1. Always Include Timestamps

```sql
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... other columns ...
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2. Use IF EXISTS / IF NOT EXISTS

```sql
-- Safe to run multiple times
CREATE TABLE IF NOT EXISTS users (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
DROP TABLE IF EXISTS deprecated_table;
```

### 3. Add Comments

```sql
COMMENT ON TABLE posts IS 'User-generated blog posts';
COMMENT ON COLUMN posts.published IS 'Whether post is publicly visible';
```

### 4. Version Your Migrations

```
migrations/
├── 20250114_001_create_profiles_table.sql
├── 20250114_002_add_user_bio.sql
├── 20250115_001_create_posts_table.sql
└── 20250115_002_add_post_categories.sql
```

Format: `YYYYMMDD_NNN_description.sql`

---

## Common Pitfalls

### ❌ Pitfall 1: Breaking Changes Without Coordination

```sql
-- DON'T rename column without updating application first
ALTER TABLE users RENAME COLUMN name TO full_name;
-- Application breaks immediately!
```

**Solution**: Use multi-step migration with grace period.

### ❌ Pitfall 2: Adding NOT NULL Without Default

```sql
-- DON'T add NOT NULL column without populating existing rows
ALTER TABLE users ADD COLUMN age integer NOT NULL;
-- ERROR: existing rows don't have value!
```

**Solution**: Add with default, or backfill first.

### ❌ Pitfall 3: Large Table Alterations

```sql
-- DON'T alter table with millions of rows without testing
ALTER TABLE events ADD COLUMN metadata jsonb;
-- Locks table for minutes/hours!
```

**Solution**: Use online schema change tools or gradual migration.

---

## Summary

**Key principles:**
1. Never break existing code
2. Always use version-controlled migrations  
3. Make changes backwards compatible
4. Test migrations locally first
5. Have rollback plan

**Safe migration workflow:**
1. Write migration SQL
2. Test on local database
3. Review with team
4. Apply to staging environment
5. Verify application still works
6. Apply to production
7. Monitor for errors
8. Keep rollback script ready

**Remember**: Gradual evolution is safer than big bang changes.
