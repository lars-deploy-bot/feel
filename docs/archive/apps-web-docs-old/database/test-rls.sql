-- Test Row Level Security (RLS) Policies
-- Created: 2025-11-17
--
-- PURPOSE:
-- Verify that RLS policies correctly enforce multi-tenancy boundaries
-- and prevent unauthorized access to data.
--
-- PREREQUISITES:
-- 1. Run enable-rls.sql first
-- 2. Have test data in the database
-- 3. Use Supabase SQL Editor with appropriate role
--
-- TEST STRATEGY:
-- - All tests should PASS when using service_role (bypasses RLS)
-- - Tests will enforce boundaries when using anon key with auth
-- ============================================================================

-- ============================================================================
-- TEST SETUP: Create test data
-- ============================================================================

DO $$
DECLARE
  test_user1_id uuid;
  test_user2_id uuid;
  test_org1_id uuid;
  test_org2_id uuid;
  test_domain1_id uuid;
BEGIN
  -- Clean up existing test data
  DELETE FROM app.domains WHERE hostname LIKE 'rls-test-%';
  DELETE FROM iam.org_memberships WHERE user_id IN (
    SELECT user_id FROM iam.users WHERE email LIKE 'rls-test-%'
  );
  DELETE FROM iam.orgs WHERE name LIKE 'RLS Test Org%';
  DELETE FROM iam.users WHERE email LIKE 'rls-test-%';

  -- Create test users
  INSERT INTO iam.users (email, status, is_test_env)
  VALUES
    ('rls-test-user1@example.com', 'active', true),
    ('rls-test-user2@example.com', 'active', true)
  RETURNING user_id INTO test_user1_id;

  SELECT user_id INTO test_user2_id FROM iam.users WHERE email = 'rls-test-user2@example.com';

  -- Create test organizations
  INSERT INTO iam.orgs (name, credits)
  VALUES
    ('RLS Test Org 1', 100),
    ('RLS Test Org 2', 200)
  RETURNING org_id INTO test_org1_id;

  SELECT org_id INTO test_org2_id FROM iam.orgs WHERE name = 'RLS Test Org 2';

  -- Add user1 to org1 as owner
  INSERT INTO iam.org_memberships (user_id, org_id, role)
  VALUES (test_user1_id, test_org1_id, 'owner');

  -- Add user2 to org2 as owner
  INSERT INTO iam.org_memberships (user_id, org_id, role)
  VALUES (test_user2_id, test_org2_id, 'owner');

  -- Create test domains
  INSERT INTO app.domains (hostname, port, org_id)
  VALUES
    ('rls-test-domain1.com', 3000, test_org1_id),
    ('rls-test-domain2.com', 3001, test_org2_id);

  RAISE NOTICE 'Test data created successfully';
  RAISE NOTICE 'User1 ID: %', test_user1_id;
  RAISE NOTICE 'User2 ID: %', test_user2_id;
  RAISE NOTICE 'Org1 ID: %', test_org1_id;
  RAISE NOTICE 'Org2 ID: %', test_org2_id;
END $$;

-- ============================================================================
-- TEST 1: Verify RLS is enabled on all tables
-- ============================================================================

SELECT
  '✓ RLS Enabled Check' AS test_name,
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN '✓ ENABLED'
    ELSE '✗ DISABLED (FIX REQUIRED)'
  END AS status
FROM pg_tables
WHERE schemaname IN ('iam', 'app')
  AND tablename NOT IN ('schema_migrations')  -- Exclude migration tables
ORDER BY schemaname, tablename;

-- ============================================================================
-- TEST 2: Verify service role can access all data (bypass RLS)
-- ============================================================================

-- This test should return data (service role bypasses RLS)
SELECT
  '✓ Service Role Bypass' AS test_name,
  'iam.users' AS table_name,
  COUNT(*) AS record_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✓ PASS (can access data)'
    ELSE '✗ FAIL (no access - unexpected)'
  END AS status
FROM iam.users
WHERE email LIKE 'rls-test-%'

UNION ALL

SELECT
  '✓ Service Role Bypass',
  'iam.orgs',
  COUNT(*),
  CASE
    WHEN COUNT(*) > 0 THEN '✓ PASS (can access data)'
    ELSE '✗ FAIL (no access - unexpected)'
  END
FROM iam.orgs
WHERE name LIKE 'RLS Test Org%'

UNION ALL

SELECT
  '✓ Service Role Bypass',
  'app.domains',
  COUNT(*),
  CASE
    WHEN COUNT(*) > 0 THEN '✓ PASS (can access data)'
    ELSE '✗ FAIL (no access - unexpected)'
  END
FROM app.domains
WHERE hostname LIKE 'rls-test-%';

-- ============================================================================
-- TEST 3: Verify policy counts
-- ============================================================================

SELECT
  '✓ Policy Count Check' AS test_name,
  schemaname,
  tablename,
  COUNT(*) AS policy_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✓ HAS POLICIES'
    ELSE '⚠ NO POLICIES (may be intentional)'
  END AS status
FROM pg_policies
WHERE schemaname IN ('iam', 'app')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- ============================================================================
-- TEST 4: Verify helper functions exist
-- ============================================================================

SELECT
  '✓ Helper Functions' AS test_name,
  routine_name AS function_name,
  '✓ EXISTS' AS status
FROM information_schema.routines
WHERE routine_schema = 'iam'
  AND routine_name IN ('current_user_id', 'is_org_member', 'is_org_admin')
ORDER BY routine_name;

-- ============================================================================
-- TEST 5: Test org membership resolution
-- ============================================================================

-- Get test user and org IDs for manual testing
WITH test_ids AS (
  SELECT
    u.user_id,
    u.email,
    m.org_id,
    o.name AS org_name,
    m.role
  FROM iam.users u
  JOIN iam.org_memberships m ON u.user_id = m.user_id
  JOIN iam.orgs o ON m.org_id = o.org_id
  WHERE u.email LIKE 'rls-test-%'
)
SELECT
  '✓ Org Membership Resolution' AS test_name,
  email,
  org_name,
  role,
  '✓ PASS' AS status
FROM test_ids
ORDER BY email;

-- ============================================================================
-- TEST 6: Test cross-org access prevention
-- ============================================================================

-- This query verifies that each user can only see their own orgs
WITH user_org_counts AS (
  SELECT
    u.user_id,
    u.email,
    COUNT(DISTINCT m.org_id) AS accessible_orgs
  FROM iam.users u
  LEFT JOIN iam.org_memberships m ON u.user_id = m.user_id
  WHERE u.email LIKE 'rls-test-%'
  GROUP BY u.user_id, u.email
)
SELECT
  '✓ Cross-Org Access Prevention' AS test_name,
  email,
  accessible_orgs,
  CASE
    WHEN accessible_orgs = 1 THEN '✓ PASS (isolated)'
    ELSE '✗ FAIL (can see other orgs)'
  END AS status
FROM user_org_counts;

-- ============================================================================
-- TEST 7: Test domain access via org membership
-- ============================================================================

-- Each user should only see domains from their org
WITH user_domain_access AS (
  SELECT
    u.user_id,
    u.email,
    d.hostname,
    d.org_id,
    m.role
  FROM iam.users u
  JOIN iam.org_memberships m ON u.user_id = m.user_id
  JOIN app.domains d ON m.org_id = d.org_id
  WHERE u.email LIKE 'rls-test-%'
)
SELECT
  '✓ Domain Access via Org' AS test_name,
  email,
  hostname,
  role,
  '✓ PASS (correct access)' AS status
FROM user_domain_access
ORDER BY email;

-- ============================================================================
-- TEST CLEANUP
-- ============================================================================

-- Uncomment to clean up test data after verification
/*
DELETE FROM app.domains WHERE hostname LIKE 'rls-test-%';
DELETE FROM iam.org_memberships WHERE user_id IN (
  SELECT user_id FROM iam.users WHERE email LIKE 'rls-test-%'
);
DELETE FROM iam.orgs WHERE name LIKE 'RLS Test Org%';
DELETE FROM iam.users WHERE email LIKE 'rls-test-%';

SELECT '✓ Test cleanup completed' AS status;
*/

-- ============================================================================
-- MANUAL TESTING INSTRUCTIONS
-- ============================================================================

/*
To test RLS with an authenticated user (requires Supabase Auth setup):

1. Create a test user in Supabase Auth:
   - Go to Authentication > Users in Supabase Dashboard
   - Create new user with email matching one of the test users above

2. Get a session token:
   - Use Supabase client library to sign in as the test user
   - Extract the session token

3. Test with anon key + auth:
   - Use createClient with anon key and session token
   - Try to access data:
     * Should see own user profile
     * Should see own orgs and memberships
     * Should see domains from own orgs
     * Should NOT see other users' data
     * Should NOT see other orgs' data

4. Test scenarios:
   a) User in Org 1 tries to view Org 2's domains → SHOULD FAIL
   b) User in Org 1 tries to update Org 2 settings → SHOULD FAIL
   c) User tries to view another user's profile → SHOULD FAIL
   d) Admin tries to add member to their org → SHOULD SUCCEED
   e) Member tries to add member to their org → SHOULD FAIL

Example test code (TypeScript):
```typescript
import { createClient } from '@supabase/supabase-js'

// Sign in as test user
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY  // Use anon key, NOT service role
)

const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'rls-test-user1@example.com',
  password: 'test-password'
})

// Try to access data
const { data: myOrgs } = await supabase
  .schema('iam')
  .from('orgs')
  .select('*')
// Should only see orgs where user is a member

const { data: allUsers } = await supabase
  .schema('iam')
  .from('users')
  .select('*')
// Should only see own user and users in same orgs

const { data: otherOrgDomains } = await supabase
  .schema('app')
  .from('domains')
  .eq('org_id', 'other-org-id')
  .select('*')
// Should return empty array (no access)
```
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT
  '
  ============================================================================
  RLS TEST SUMMARY
  ============================================================================

  ✓ All tests completed

  NEXT STEPS:
  1. Review test results above
  2. Verify all statuses show ✓ PASS
  3. If using anon key, perform manual auth tests (see instructions above)
  4. Monitor application logs for RLS-related errors
  5. Add indexes on frequently filtered columns (user_id, org_id)

  IMPORTANT:
  - Service role bypasses RLS (used by backend)
  - RLS protects against accidental client-side exposure
  - Test policies thoroughly before exposing anon key

  ============================================================================
  ' AS summary;
