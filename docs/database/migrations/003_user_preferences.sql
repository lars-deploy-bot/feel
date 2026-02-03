-- Migration: Create user_preferences table for cross-device sync
-- Date: 2026-02-01
-- Purpose: Enable workspace selection and recent workspaces to sync across devices
--
-- Schema: iam
-- Table: user_preferences
--
-- Design notes:
-- - User-scoped preferences (one row per user)
-- - JSONB for flexible key-value storage
-- - Automatic updated_at tracking

BEGIN;

-- ============================================================================
-- USER_PREFERENCES
-- Stores per-user settings that should sync across devices
-- ============================================================================

CREATE TABLE IF NOT EXISTS iam.user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES iam.users(user_id) ON DELETE CASCADE,

  -- Current workspace (what user was last working on)
  current_workspace TEXT,

  -- Selected organization
  selected_org_id TEXT REFERENCES iam.orgs(org_id) ON DELETE SET NULL,

  -- Recent workspaces (array of {domain, orgId, lastAccessed})
  recent_workspaces JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Generic preferences blob for future expansion
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_user_preferences_org ON iam.user_preferences(selected_org_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE iam.user_preferences ENABLE ROW LEVEL SECURITY;

-- Grant permissions to service role
GRANT ALL ON iam.user_preferences TO service_role;

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences"
  ON iam.user_preferences FOR SELECT
  USING (user_id = sub());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON iam.user_preferences FOR INSERT
  WITH CHECK (user_id = sub());

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON iam.user_preferences FOR UPDATE
  USING (user_id = sub())
  WITH CHECK (user_id = sub());

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences"
  ON iam.user_preferences FOR DELETE
  USING (user_id = sub());

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION iam.update_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON iam.user_preferences
  FOR EACH ROW EXECUTE FUNCTION iam.update_preferences_updated_at();

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'iam' AND table_name = 'user_preferences';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'iam' AND tablename = 'user_preferences';
