-- Enable Row Level Security (RLS) for IAM and App Schemas
-- Created: 2025-11-17
--
-- CRITICAL SECURITY NOTES:
-- 1. Service role bypasses RLS by default (used for all backend operations)
-- 2. These policies protect against accidental exposure if anon key is ever used
-- 3. Policies enforce multi-tenancy boundaries (users → orgs → domains)
--
-- RUN ORDER:
-- 1. Run this script in Supabase SQL Editor
-- 2. Verify with test queries (see bottom of file)
-- 3. Update app code if needed (service role continues working as-is)

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current authenticated user ID from Supabase auth
-- Used by RLS policies to identify the requesting user
CREATE OR REPLACE FUNCTION iam.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.uid(),  -- Supabase Auth user ID
    NULL::uuid
  );
$$;

-- Check if user is a member of an organization (any role)
CREATE OR REPLACE FUNCTION iam.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM iam.org_memberships
    WHERE org_id = p_org_id
      AND user_id = iam.current_user_id()
  );
$$;

-- Check if user is an admin or owner of an organization
CREATE OR REPLACE FUNCTION iam.is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM iam.org_memberships
    WHERE org_id = p_org_id
      AND user_id = iam.current_user_id()
      AND role IN ('owner', 'admin')
  );
$$;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

-- IAM Schema Tables
ALTER TABLE iam.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.org_invites ENABLE ROW LEVEL SECURITY;

-- App Schema Tables
ALTER TABLE app.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.gateway_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: iam.users
-- Users can only access their own user record
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON iam.users
  FOR SELECT
  USING (user_id = iam.current_user_id());

-- Users can update their own profile (not password_hash directly)
CREATE POLICY "Users can update own profile"
  ON iam.users
  FOR UPDATE
  USING (user_id = iam.current_user_id())
  WITH CHECK (
    user_id = iam.current_user_id()
    -- Prevent direct password_hash updates (should use separate auth flow)
    AND password_hash IS NOT DISTINCT FROM (SELECT password_hash FROM iam.users WHERE user_id = iam.current_user_id())
  );

-- Users can read other users' basic info if they share an org
CREATE POLICY "Users can view org members"
  ON iam.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM iam.org_memberships m1
      JOIN iam.org_memberships m2 ON m1.org_id = m2.org_id
      WHERE m1.user_id = user_id
        AND m2.user_id = iam.current_user_id()
    )
  );

-- ============================================================================
-- POLICIES: iam.sessions
-- Users can only access their own sessions
-- ============================================================================

CREATE POLICY "Users can view own sessions"
  ON iam.sessions
  FOR SELECT
  USING (user_id = iam.current_user_id());

CREATE POLICY "Users can create own sessions"
  ON iam.sessions
  FOR INSERT
  WITH CHECK (user_id = iam.current_user_id());

CREATE POLICY "Users can update own sessions"
  ON iam.sessions
  FOR UPDATE
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

CREATE POLICY "Users can delete own sessions"
  ON iam.sessions
  FOR DELETE
  USING (user_id = iam.current_user_id());

-- ============================================================================
-- POLICIES: iam.orgs
-- Users can view orgs they're members of
-- Only owners/admins can update org details
-- ============================================================================

CREATE POLICY "Users can view member orgs"
  ON iam.orgs
  FOR SELECT
  USING (iam.is_org_member(org_id));

CREATE POLICY "Admins can update org details"
  ON iam.orgs
  FOR UPDATE
  USING (iam.is_org_admin(org_id))
  WITH CHECK (iam.is_org_admin(org_id));

-- Note: Org creation handled by backend (service role)
-- No INSERT policy for regular users

-- ============================================================================
-- POLICIES: iam.org_memberships
-- Users can view memberships for orgs they belong to
-- Only admins can manage memberships
-- ============================================================================

CREATE POLICY "Users can view org memberships"
  ON iam.org_memberships
  FOR SELECT
  USING (
    -- Can see own membership
    user_id = iam.current_user_id()
    OR
    -- Can see other memberships in their orgs
    iam.is_org_member(org_id)
  );

CREATE POLICY "Admins can manage memberships"
  ON iam.org_memberships
  FOR ALL
  USING (iam.is_org_admin(org_id))
  WITH CHECK (iam.is_org_admin(org_id));

-- ============================================================================
-- POLICIES: iam.org_invites
-- Users can view invites for orgs they're admins of
-- Only admins can create/manage invites
-- ============================================================================

CREATE POLICY "Users can view own invites"
  ON iam.org_invites
  FOR SELECT
  USING (
    -- Can see invites sent to their email
    email = (SELECT email FROM iam.users WHERE user_id = iam.current_user_id())
    OR
    -- Can see invites for orgs they admin
    iam.is_org_admin(org_id)
  );

CREATE POLICY "Admins can manage invites"
  ON iam.org_invites
  FOR ALL
  USING (iam.is_org_admin(org_id))
  WITH CHECK (iam.is_org_admin(org_id));

-- ============================================================================
-- POLICIES: app.domains
-- Users can view domains for orgs they belong to
-- Only admins can manage domains
-- ============================================================================

CREATE POLICY "Users can view org domains"
  ON app.domains
  FOR SELECT
  USING (iam.is_org_member(org_id));

CREATE POLICY "Admins can manage domains"
  ON app.domains
  FOR ALL
  USING (iam.is_org_admin(org_id))
  WITH CHECK (iam.is_org_admin(org_id));

-- ============================================================================
-- POLICIES: app.errors
-- Users can view errors for domains in their orgs
-- Users can create errors (for logging)
-- ============================================================================

CREATE POLICY "Users can view org errors"
  ON app.errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app.domains d
      WHERE d.domain_id = app.errors.domain_id
        AND iam.is_org_member(d.org_id)
    )
  );

CREATE POLICY "Users can create errors"
  ON app.errors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.domains d
      WHERE d.domain_id = app.errors.domain_id
        AND iam.is_org_member(d.org_id)
    )
  );

-- ============================================================================
-- POLICIES: app.feedback
-- Users can view/create feedback for their own user account
-- ============================================================================

CREATE POLICY "Users can view own feedback"
  ON app.feedback
  FOR SELECT
  USING (user_id = iam.current_user_id());

CREATE POLICY "Users can create feedback"
  ON app.feedback
  FOR INSERT
  WITH CHECK (user_id = iam.current_user_id());

-- ============================================================================
-- POLICIES: app.user_profile
-- Users can only access their own profile
-- ============================================================================

CREATE POLICY "Users can view own profile"
  ON app.user_profile
  FOR SELECT
  USING (user_id = iam.current_user_id());

CREATE POLICY "Users can manage own profile"
  ON app.user_profile
  FOR ALL
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

-- ============================================================================
-- POLICIES: app.user_onboarding
-- Users can only access their own onboarding state
-- ============================================================================

CREATE POLICY "Users can view own onboarding"
  ON app.user_onboarding
  FOR SELECT
  USING (user_id = iam.current_user_id());

CREATE POLICY "Users can manage own onboarding"
  ON app.user_onboarding
  FOR ALL
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

-- ============================================================================
-- POLICIES: app.gateway_settings
-- Users can view/manage settings for domains in their orgs
-- ============================================================================

CREATE POLICY "Users can view org gateway settings"
  ON app.gateway_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app.domains d
      WHERE d.domain_id = app.gateway_settings.domain_id
        AND iam.is_org_member(d.org_id)
    )
  );

CREATE POLICY "Admins can manage gateway settings"
  ON app.gateway_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM app.domains d
      WHERE d.domain_id = app.gateway_settings.domain_id
        AND iam.is_org_admin(d.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.domains d
      WHERE d.domain_id = app.gateway_settings.domain_id
        AND iam.is_org_admin(d.org_id)
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify RLS is working correctly
-- ============================================================================

-- Check RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname IN ('iam', 'app')
ORDER BY schemaname, tablename;

-- View all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname IN ('iam', 'app')
ORDER BY schemaname, tablename, policyname;

-- Count policies per table
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname IN ('iam', 'app')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- 1. SERVICE ROLE BYPASS:
--    The service role (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS entirely.
--    All backend operations continue to work without modification.
--
-- 2. ANON KEY PROTECTION:
--    If the anon key is ever exposed client-side, these policies will
--    enforce proper multi-tenancy boundaries.
--
-- 3. AUTHENTICATION:
--    Policies assume Supabase Auth is used (auth.uid()).
--    Current implementation uses JWT sessions server-side only.
--
-- 4. TESTING:
--    Before deploying, test with anon key to ensure policies work:
--    - Create test user in Supabase Auth
--    - Try accessing other users' data (should fail)
--    - Verify org-based access works correctly
--
-- 5. PERFORMANCE:
--    RLS policies add WHERE clauses to queries.
--    Ensure indexes exist on:
--    - iam.users(user_id)
--    - iam.sessions(user_id)
--    - iam.org_memberships(user_id, org_id)
--    - app.domains(org_id)
--
-- 6. MAINTENANCE:
--    When adding new tables, always:
--    - Enable RLS: ALTER TABLE schema.table ENABLE ROW LEVEL SECURITY;
--    - Create appropriate policies
--    - Test with anon key
