-- Grant Service Role Permissions for IAM and App Schemas
-- Run this in Supabase SQL Editor to allow service_role to access custom schemas

-- CRITICAL: Service role needs these grants to:
-- 1. Run integration tests (credit-system-supabase.test.ts)
-- 2. Perform admin operations (credit management, user updates)
-- 3. Access both iam and app schemas from server-side code

-- Grant USAGE on schemas
GRANT USAGE ON SCHEMA iam TO service_role;
GRANT USAGE ON SCHEMA app TO service_role;

-- Grant ALL privileges on all tables in iam schema
GRANT ALL ON ALL TABLES IN SCHEMA iam TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA iam TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA iam TO service_role;

-- Grant ALL privileges on all tables in app schema
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA app TO service_role;

-- Make sure future objects also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON FUNCTIONS TO service_role;

-- Verify grants
SELECT
  schemaname,
  tablename,
  array_agg(DISTINCT privilege_type) as privileges
FROM information_schema.role_table_grants
WHERE grantee = 'service_role'
  AND schemaname IN ('iam', 'app')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;
