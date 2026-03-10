-- =============================================================================
-- Migration 0020: Add first_name / last_name to iam.users
--
-- Replaces the single display_name field with structured name columns.
-- display_name is kept for backwards compatibility but first_name/last_name
-- are the source of truth going forward.
--
-- Applied: 2026-03-11 (production first, then staging)
-- =============================================================================

ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Grant access via PostgREST
GRANT SELECT (first_name, last_name) ON iam.users TO authenticated;
GRANT SELECT (first_name, last_name) ON iam.users TO service_role;
GRANT UPDATE (first_name, last_name) ON iam.users TO service_role;

-- Notify PostgREST to pick up schema change
NOTIFY pgrst, 'reload schema';
