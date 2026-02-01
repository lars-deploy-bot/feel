#!/bin/bash
# Run user_preferences migration
# Usage: ./migrations/003_user_preferences.sh

set -e

export PGPASSWORD="MUL86buNIvkRLf50"
DB_URL="postgresql://postgres@db.qnvprftdorualkdyogka.supabase.co:5432/postgres"

echo "Running migration: Create iam.user_preferences table..."

psql "$DB_URL" << 'EOF'
-- Create user_preferences table
CREATE TABLE IF NOT EXISTS iam.user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES iam.users(user_id) ON DELETE CASCADE,
  current_workspace TEXT,
  selected_org_id TEXT REFERENCES iam.orgs(org_id) ON DELETE SET NULL,
  recent_workspaces JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_preferences_org ON iam.user_preferences(selected_org_id);

-- RLS
ALTER TABLE iam.user_preferences ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON iam.user_preferences TO service_role;

-- Policies (drop if exists to be idempotent)
DROP POLICY IF EXISTS "Users can view own preferences" ON iam.user_preferences;
CREATE POLICY "Users can view own preferences" ON iam.user_preferences FOR SELECT USING (user_id = sub());

DROP POLICY IF EXISTS "Users can insert own preferences" ON iam.user_preferences;
CREATE POLICY "Users can insert own preferences" ON iam.user_preferences FOR INSERT WITH CHECK (user_id = sub());

DROP POLICY IF EXISTS "Users can update own preferences" ON iam.user_preferences;
CREATE POLICY "Users can update own preferences" ON iam.user_preferences FOR UPDATE USING (user_id = sub()) WITH CHECK (user_id = sub());

DROP POLICY IF EXISTS "Users can delete own preferences" ON iam.user_preferences;
CREATE POLICY "Users can delete own preferences" ON iam.user_preferences FOR DELETE USING (user_id = sub());

-- Trigger
CREATE OR REPLACE FUNCTION iam.update_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_preferences_updated_at ON iam.user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON iam.user_preferences
  FOR EACH ROW EXECUTE FUNCTION iam.update_preferences_updated_at();

SELECT 'SUCCESS: Table created' as result;
EOF

echo "Migration completed!"
