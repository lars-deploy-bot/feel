-- Update RLS Helper Functions to Use public.sub()
-- Created: 2025-11-17
--
-- PURPOSE: Update iam.current_user_id() to use existing public.sub() function
-- PREREQUISITES: Supabase JWT secret must match your JWT_SECRET
--
-- ============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS iam.current_user_id();

-- Create new function that uses public.sub()
-- The public.sub() function already extracts 'sub' claim from JWT
CREATE OR REPLACE FUNCTION iam.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NULLIF(public.sub(), '')::uuid;
$$;

-- Verification: Test that function exists and works
SELECT
  'iam.current_user_id()' AS function_name,
  iam.current_user_id() AS current_value,
  CASE
    WHEN iam.current_user_id() IS NULL THEN '✓ Returns NULL (not authenticated)'
    ELSE '✓ Returns user ID'
  END AS status;

-- Test with simulated JWT
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get a test user
  SELECT user_id INTO test_user_id FROM iam.users WHERE is_test_env = true LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    -- Set JWT claims with 'sub'
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id::text)::text, true);

    -- Test
    IF iam.current_user_id() = test_user_id THEN
      RAISE NOTICE '✓ PASS: iam.current_user_id() = %', test_user_id;
    ELSE
      RAISE NOTICE '✗ FAIL: Expected %, got %', test_user_id, iam.current_user_id();
    END IF;

    -- Reset
    PERFORM set_config('request.jwt.claims', null, true);
  ELSE
    RAISE NOTICE '⚠ No test users found';
  END IF;
END $$;
