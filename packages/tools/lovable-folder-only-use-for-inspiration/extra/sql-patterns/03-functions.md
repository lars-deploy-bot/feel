# PostgreSQL Function Patterns

## Database Functions for Business Logic

PostgreSQL functions enable server-side logic, complex calculations, and helper utilities.

---

## Basic Function Patterns

### 1. Simple Helper Function
```sql
CREATE OR REPLACE FUNCTION full_name(first_name text, last_name text)
RETURNS text AS $$
BEGIN
  RETURN first_name || ' ' || last_name;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT full_name('John', 'Doe'); -- Returns: 'John Doe'
```

### 2. Function Returning Query
```sql
CREATE OR REPLACE FUNCTION get_active_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.created_at
  FROM users u
  WHERE u.status = 'active'
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM get_active_users();
```

### 3. Function with Default Parameters
```sql
CREATE OR REPLACE FUNCTION search_posts(
  search_term text DEFAULT '',
  limit_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  content text
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.title, p.content
  FROM posts p
  WHERE p.title ILIKE '%' || search_term || '%'
     OR p.content ILIKE '%' || search_term || '%'
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM search_posts('postgresql'); -- Uses default limit
SELECT * FROM search_posts('postgresql', 20); -- Custom limit
```

---

## Security & RLS Helper Functions

### 4. Current User Helper
```sql
-- Get current user's data
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid AS $$
  SELECT auth.uid();
$$ LANGUAGE sql;

-- Usage in queries
SELECT * FROM posts WHERE user_id = current_user_id();
```

### 5. Check User Role
```sql
CREATE OR REPLACE FUNCTION user_has_role(required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage
SELECT * FROM sensitive_data WHERE user_has_role('admin');
```

### 6. Get User Organizations
```sql
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT org_id
  FROM user_organizations
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Usage in RLS policy
CREATE POLICY "org_access"
ON documents
FOR ALL
TO authenticated
USING (org_id IN (SELECT user_org_ids()));
```

---

## Trigger Functions

### 7. Auto-Update Timestamp
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to table
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 8. Audit Log Trigger
```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text,
  operation text,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    operation,
    old_data,
    new_data,
    user_id
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE NULL END,
    auth.uid()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to table
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();
```

### 9. Sync Related Records
```sql
-- Update post count when comments change
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comment_count();
```

---

## Data Validation Functions

### 10. Validate Email Format
```sql
CREATE OR REPLACE FUNCTION is_valid_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Use in constraint
ALTER TABLE users
ADD CONSTRAINT valid_email_format
CHECK (is_valid_email(email));
```

### 11. Validate JSON Schema
```sql
CREATE OR REPLACE FUNCTION validate_settings(settings jsonb)
RETURNS boolean AS $$
BEGIN
  -- Check required fields
  IF NOT (settings ? 'theme' AND settings ? 'language') THEN
    RETURN false;
  END IF;
  
  -- Validate values
  IF NOT (settings->>'theme' IN ('light', 'dark')) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE user_preferences
ADD CONSTRAINT valid_settings
CHECK (validate_settings(settings));
```

---

## Data Transformation Functions

### 12. Slug Generation
```sql
CREATE OR REPLACE FUNCTION generate_slug(input text)
RETURNS text AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(input, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+',
      '-',
      'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage
UPDATE posts SET slug = generate_slug(title) WHERE slug IS NULL;
```

### 13. Calculate Age
```sql
CREATE OR REPLACE FUNCTION calculate_age(birth_date date)
RETURNS int AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(current_date, birth_date))::int;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage
SELECT name, calculate_age(birth_date) as age FROM users;
```

### 14. Format Currency
```sql
CREATE OR REPLACE FUNCTION format_currency(amount numeric, currency text DEFAULT 'USD')
RETURNS text AS $$
BEGIN
  RETURN '$' || to_char(amount, 'FM999,999,999.00');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage
SELECT format_currency(1234.56); -- Returns: '$1,234.56'
```

---

## Aggregation Functions

### 15. Calculate User Stats
```sql
CREATE OR REPLACE FUNCTION user_statistics(user_id uuid)
RETURNS TABLE (
  total_posts bigint,
  total_comments bigint,
  total_likes bigint,
  avg_post_length numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT c.id) as total_comments,
    COUNT(DISTINCT l.id) as total_likes,
    AVG(LENGTH(p.content)) as avg_post_length
  FROM users u
  LEFT JOIN posts p ON p.author_id = u.id
  LEFT JOIN comments c ON c.user_id = u.id
  LEFT JOIN likes l ON l.user_id = u.id
  WHERE u.id = user_id
  GROUP BY u.id;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM user_statistics('user-uuid');
```

### 16. Leaderboard Function
```sql
CREATE OR REPLACE FUNCTION get_leaderboard(limit_count int DEFAULT 10)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  username text,
  total_points bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(p.points) DESC) as rank,
    u.id as user_id,
    u.username,
    SUM(p.points) as total_points
  FROM users u
  LEFT JOIN user_points p ON p.user_id = u.id
  GROUP BY u.id, u.username
  ORDER BY total_points DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Search Functions

### 17. Full Text Search
```sql
CREATE OR REPLACE FUNCTION search_content(
  search_query text,
  result_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  snippet text,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    ts_headline('english', p.content, plainto_tsquery('english', search_query)) as snippet,
    ts_rank(to_tsvector('english', p.title || ' ' || p.content), plainto_tsquery('english', search_query)) as rank
  FROM posts p
  WHERE to_tsvector('english', p.title || ' ' || p.content) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
```

### 18. Fuzzy Search (Similarity)
```sql
-- Requires pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION fuzzy_search(
  search_term text,
  threshold real DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  name text,
  similarity real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    similarity(u.name, search_term) as similarity
  FROM users u
  WHERE similarity(u.name, search_term) > threshold
  ORDER BY similarity DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## Complex Business Logic

### 19. Calculate Subscription Status
```sql
CREATE OR REPLACE FUNCTION subscription_status(user_id uuid)
RETURNS text AS $$
DECLARE
  sub_record record;
  status text;
BEGIN
  SELECT * INTO sub_record
  FROM subscriptions
  WHERE subscriptions.user_id = subscription_status.user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN 'none';
  END IF;
  
  IF sub_record.canceled_at IS NOT NULL THEN
    IF sub_record.expires_at > now() THEN
      RETURN 'canceled_but_active';
    ELSE
      RETURN 'expired';
    END IF;
  ELSIF sub_record.expires_at < now() THEN
    RETURN 'expired';
  ELSIF sub_record.trial_ends_at > now() THEN
    RETURN 'trial';
  ELSE
    RETURN 'active';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 20. Apply Discount
```sql
CREATE OR REPLACE FUNCTION calculate_discounted_price(
  original_price numeric,
  discount_code text DEFAULT NULL
)
RETURNS numeric AS $$
DECLARE
  discount_percent numeric;
  final_price numeric;
BEGIN
  final_price := original_price;
  
  IF discount_code IS NOT NULL THEN
    SELECT discount_percentage INTO discount_percent
    FROM discount_codes
    WHERE code = discount_code
      AND valid_from <= now()
      AND valid_until >= now()
      AND uses_remaining > 0;
    
    IF FOUND THEN
      final_price := original_price * (1 - discount_percent / 100.0);
      
      -- Update usage
      UPDATE discount_codes
      SET uses_remaining = uses_remaining - 1
      WHERE code = discount_code;
    END IF;
  END IF;
  
  RETURN ROUND(final_price, 2);
END;
$$ LANGUAGE plpgsql;
```

---

## Utility Functions

### 21. Generate Random String
```sql
CREATE OR REPLACE FUNCTION random_string(length int DEFAULT 32)
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, (random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Usage
UPDATE users SET reset_token = random_string(64) WHERE email = 'user@example.com';
```

### 22. Generate UUID from Text
```sql
CREATE OR REPLACE FUNCTION deterministic_uuid(input text)
RETURNS uuid AS $$
BEGIN
  RETURN uuid_generate_v5(uuid_ns_url(), input);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage (same input always gives same UUID)
SELECT deterministic_uuid('user@example.com');
```

### 23. JSON Array Append
```sql
CREATE OR REPLACE FUNCTION jsonb_array_append(
  arr jsonb,
  new_element jsonb
)
RETURNS jsonb AS $$
BEGIN
  IF arr IS NULL THEN
    RETURN jsonb_build_array(new_element);
  ELSE
    RETURN arr || jsonb_build_array(new_element);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage
UPDATE settings SET tags = jsonb_array_append(tags, '"new_tag"') WHERE id = 1;
```

---

## Performance Optimization

### 24. Materialized View Refresh
```sql
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Call this from scheduled job or trigger
```

### 25. Batch Insert
```sql
CREATE OR REPLACE FUNCTION bulk_insert_logs(log_data jsonb[])
RETURNS void AS $$
BEGIN
  INSERT INTO logs (level, message, metadata, created_at)
  SELECT
    (data->>'level')::text,
    (data->>'message')::text,
    (data->'metadata')::jsonb,
    now()
  FROM unnest(log_data) as data;
END;
$$ LANGUAGE plpgsql;
```

---

## Function Management

```sql
-- List all functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public';

-- Drop function
DROP FUNCTION IF EXISTS function_name(parameter_types);

-- View function definition
\df+ function_name  -- In psql
-- Or
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'function_name';
```

---

## Best Practices

1. **Use SECURITY DEFINER carefully**
   - Only when function needs elevated privileges
   - Be cautious of SQL injection

2. **Mark functions IMMUTABLE when possible**
   - Enables better query optimization
   - Only for functions that always return same output for same input

3. **Use STABLE for functions that don't modify data**
   - Better than VOLATILE for read-only functions

4. **Return TABLE instead of SETOF RECORD**
   - More explicit and easier to use

5. **Handle NULL inputs explicitly**
   - Document expected behavior

6. **Use proper exception handling**
   ```sql
   BEGIN
     -- code
   EXCEPTION
     WHEN others THEN
       RAISE NOTICE 'Error: %', SQLERRM;
       RETURN NULL;
   END;
   ```

7. **Test functions thoroughly**
   - Include edge cases, NULL values, empty inputs

8. **Document function purpose**
   ```sql
   COMMENT ON FUNCTION my_function IS 'Calculates user score based on activity';
   ```

Remember: Functions are powerful but can impact performance if complex. Use them for reusable logic and keep them focused on single responsibilities.
