# PostgreSQL Trigger Patterns

## Automated Database Actions with Triggers

Triggers automatically execute functions when specific database events occur.

---

## Basic Trigger Patterns

### 1. Auto-Update Timestamp
```sql
-- Trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
```

### 2. Set Created/Updated By
```sql
CREATE OR REPLACE FUNCTION set_user_tracking()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
    NEW.created_at = now();
  END IF;
  
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_user_changes
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_user_tracking();
```

---

## Audit & Logging Triggers

### 3. Complete Audit Log
```sql
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid,
  operation text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_data = to_jsonb(OLD);
    INSERT INTO audit_log (
      table_name,
      record_id,
      operation,
      old_values,
      changed_by
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      TG_OP,
      old_data,
      auth.uid()
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data = to_jsonb(OLD);
    new_data = to_jsonb(NEW);
    INSERT INTO audit_log (
      table_name,
      record_id,
      operation,
      old_values,
      new_values,
      changed_by
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      TG_OP,
      old_data,
      new_data,
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_data = to_jsonb(NEW);
    INSERT INTO audit_log (
      table_name,
      record_id,
      operation,
      new_values,
      changed_by
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      TG_OP,
      new_data,
      auth.uid()
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to tables
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION audit_trigger_func();
```

### 4. Change Log (Delta Only)
```sql
CREATE TABLE change_log (
  id bigserial PRIMARY KEY,
  table_name text,
  record_id uuid,
  column_name text,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_record jsonb;
  new_record jsonb;
  key text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_record = to_jsonb(OLD);
    new_record = to_jsonb(NEW);
    
    FOR key IN SELECT jsonb_object_keys(new_record)
    LOOP
      IF old_record->>key IS DISTINCT FROM new_record->>key THEN
        INSERT INTO change_log (
          table_name,
          record_id,
          column_name,
          old_value,
          new_value,
          changed_by
        ) VALUES (
          TG_TABLE_NAME,
          NEW.id,
          key,
          old_record->>key,
          new_record->>key,
          auth.uid()
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_changes
AFTER UPDATE ON sensitive_data
FOR EACH ROW
EXECUTE FUNCTION log_changes();
```

---

## Validation Triggers

### 5. Prevent Invalid Updates
```sql
CREATE OR REPLACE FUNCTION prevent_status_downgrade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status < OLD.status THEN
    RAISE EXCEPTION 'Cannot downgrade status from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_status_change
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION prevent_status_downgrade();
```

### 6. Validate Business Rules
```sql
CREATE OR REPLACE FUNCTION validate_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for overlapping bookings
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE room_id = NEW.room_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    )
  ) THEN
    RAISE EXCEPTION 'Room is already booked for this time period';
  END IF;
  
  -- Check minimum booking duration
  IF NEW.end_time - NEW.start_time < interval '1 hour' THEN
    RAISE EXCEPTION 'Minimum booking duration is 1 hour';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_booking_constraints
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION validate_booking();
```

---

## Synchronization Triggers

### 7. Sync Denormalized Data
```sql
-- Keep post comment count in sync
CREATE OR REPLACE FUNCTION sync_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET comment_count = comment_count + 1,
        last_comment_at = NEW.created_at
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET comment_count = GREATEST(0, comment_count - 1),
        last_comment_at = (
          SELECT MAX(created_at)
          FROM comments
          WHERE post_id = OLD.post_id
        )
    WHERE id = OLD.post_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_comment_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION sync_comment_count();
```

### 8. Update Parent Timestamp
```sql
-- Touch parent record when child changes
CREATE OR REPLACE FUNCTION touch_parent()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts
  SET updated_at = now()
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_post_on_comment_change
AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION touch_parent();
```

### 9. Cascade Soft Deletes
```sql
-- Soft delete children when parent is soft deleted
CREATE OR REPLACE FUNCTION cascade_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Parent was just soft deleted
    UPDATE comments
    SET deleted_at = NEW.deleted_at
    WHERE post_id = NEW.id
      AND deleted_at IS NULL;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Parent was restored
    UPDATE comments
    SET deleted_at = NULL
    WHERE post_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cascade_post_deletion
AFTER UPDATE ON posts
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_soft_delete();
```

---

## Notification Triggers

### 10. Send Database Notification
```sql
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
BEGIN
  payload = jsonb_build_object(
    'id', NEW.id,
    'from', NEW.sender_id,
    'to', NEW.recipient_id,
    'preview', LEFT(NEW.content, 50)
  );
  
  PERFORM pg_notify('new_message', payload::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();
```

### 11. Queue Background Job
```sql
CREATE TABLE job_queue (
  id bigserial PRIMARY KEY,
  job_type text NOT NULL,
  payload jsonb,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION queue_email_job()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO job_queue (job_type, payload)
  VALUES (
    'send_welcome_email',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'name', NEW.name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_welcome_email
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION queue_email_job();
```

---

## Data Transformation Triggers

### 12. Auto-Generate Slug
```sql
CREATE OR REPLACE FUNCTION generate_slug_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug = lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
  END IF;
  
  -- Ensure uniqueness
  WHILE EXISTS (
    SELECT 1 FROM posts
    WHERE slug = NEW.slug
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    NEW.slug = NEW.slug || '-' || floor(random() * 1000)::text;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_post_slug
BEFORE INSERT OR UPDATE OF title ON posts
FOR EACH ROW
EXECUTE FUNCTION generate_slug_trigger();
```

### 13. Normalize Data
```sql
CREATE OR REPLACE FUNCTION normalize_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = lower(trim(NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_user_email
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION normalize_email();
```

---

## Security Triggers

### 14. Prevent Unauthorized Deletes
```sql
CREATE OR REPLACE FUNCTION prevent_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can delete admin accounts';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_admins
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_admin_delete();
```

### 15. Encrypt Sensitive Data
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION encrypt_ssn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ssn IS NOT NULL THEN
    NEW.ssn_encrypted = pgp_sym_encrypt(
      NEW.ssn,
      current_setting('app.encryption_key')
    );
    NEW.ssn = NULL; -- Clear plaintext
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_user_ssn
BEFORE INSERT OR UPDATE ON user_data
FOR EACH ROW
EXECUTE FUNCTION encrypt_ssn();
```

---

## Conditional Triggers

### 16. Trigger Only on Specific Column Changes
```sql
CREATE TRIGGER update_search_index
AFTER UPDATE OF title, content ON posts
FOR EACH ROW
WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION refresh_search_index();
```

### 17. Trigger Based on Status Change
```sql
CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Send completion notification
    INSERT INTO notifications (user_id, message)
    VALUES (NEW.user_id, 'Your order #' || NEW.id || ' is complete!');
    
    -- Update user stats
    UPDATE users
    SET total_orders = total_orders + 1
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_complete
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_order_completion();
```

---

## Performance Optimization

### 18. Deferred Constraint Checking
```sql
-- Run trigger after all row operations in transaction
CREATE CONSTRAINT TRIGGER check_batch_totals
AFTER INSERT OR UPDATE ON order_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_order_total();
```

### 19. Conditional Trigger Execution
```sql
CREATE OR REPLACE FUNCTION update_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stats during business hours
  IF EXTRACT(hour FROM now()) BETWEEN 9 AND 17 THEN
    -- Update logic
    UPDATE daily_stats SET count = count + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Trigger Management

```sql
-- List all triggers
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Disable trigger
ALTER TABLE table_name DISABLE TRIGGER trigger_name;

-- Enable trigger
ALTER TABLE table_name ENABLE TRIGGER trigger_name;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_name ON table_name;

-- Disable all triggers on table (careful!)
ALTER TABLE table_name DISABLE TRIGGER ALL;

-- Enable all triggers
ALTER TABLE table_name ENABLE TRIGGER ALL;
```

---

## Trigger Types & Timing

### BEFORE vs AFTER
```sql
-- BEFORE: Can modify NEW, prevent operation
CREATE TRIGGER validate_before
BEFORE INSERT OR UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION validation_func();

-- AFTER: Cannot modify, for side effects
CREATE TRIGGER log_after
AFTER INSERT OR UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION log_func();
```

### FOR EACH ROW vs FOR EACH STATEMENT
```sql
-- FOR EACH ROW: Runs once per affected row
CREATE TRIGGER per_row
AFTER UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION row_func();

-- FOR EACH STATEMENT: Runs once per statement (more efficient for batch operations)
CREATE TRIGGER per_statement
AFTER UPDATE ON table_name
FOR EACH STATEMENT
EXECUTE FUNCTION statement_func();
```

---

## Best Practices

1. **Keep trigger functions simple and fast**
   - Complex logic slows down all operations
   - Consider async jobs for heavy processing

2. **Be careful with cascading triggers**
   - Trigger A calls B calls C... can be hard to debug
   - Document trigger chains

3. **Avoid infinite loops**
   - Don't update the same table that fired the trigger
   - Use careful conditions to prevent recursion

4. **Use WHEN clause to reduce overhead**
   ```sql
   CREATE TRIGGER only_when_needed
   AFTER UPDATE ON table_name
   FOR EACH ROW
   WHEN (NEW.status IS DISTINCT FROM OLD.status)
   EXECUTE FUNCTION func();
   ```

5. **Handle exceptions gracefully**
   ```sql
   BEGIN
     -- trigger logic
   EXCEPTION
     WHEN OTHERS THEN
       RAISE NOTICE 'Trigger error: %', SQLERRM;
       RETURN NULL; -- Or OLD/NEW depending on trigger type
   END;
   ```

6. **Test trigger behavior**
   - Test INSERT, UPDATE, DELETE scenarios
   - Test NULL values
   - Test edge cases

7. **Document trigger purpose**
   ```sql
   COMMENT ON TRIGGER my_trigger ON table_name IS
   'Automatically updates related records when status changes';
   ```

8. **Monitor trigger performance**
   - Triggers add overhead to every operation
   - Use EXPLAIN ANALYZE to measure impact

Remember: Triggers are powerful but can make debugging difficult. Use them for data integrity and automation, but keep them simple and well-documented.
