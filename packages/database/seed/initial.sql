-- ============================================================================
-- Claude Bridge Initial Seed Data
-- ============================================================================
-- Run this after applying migrations to populate initial data.
--
-- Usage:
--   psql $DATABASE_URL < packages/database/seed/initial.sql
--
-- Or in Supabase SQL Editor, copy and paste this content.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Integration Providers
-- ============================================================================
-- OAuth providers that users can connect to

INSERT INTO integrations.providers (provider_key, display_name, logo_path, default_scopes, visibility_level, is_active)
VALUES
  ('linear', 'Linear', '/integrations/linear.svg', '["read", "write", "issues:create"]', 'public', true),
  ('gmail', 'Gmail', '/integrations/gmail.svg', '["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"]', 'public', true),
  ('stripe', 'Stripe', '/integrations/stripe.svg', '["read_write"]', 'public', true),
  ('github', 'GitHub', '/integrations/github.svg', '["repo", "read:user"]', 'public', true),
  ('slack', 'Slack', '/integrations/slack.svg', '["channels:read", "chat:write"]', 'beta', false),
  ('notion', 'Notion', '/integrations/notion.svg', '["read_content", "insert_content"]', 'beta', false)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  logo_path = EXCLUDED.logo_path,
  default_scopes = EXCLUDED.default_scopes,
  visibility_level = EXCLUDED.visibility_level;

-- ============================================================================
-- Site Templates
-- ============================================================================
-- Templates available for new site deployments

INSERT INTO app.templates (name, description, ai_description, source_path, preview_url, is_active)
VALUES
  (
    'Blank',
    'A minimal starter template with just the essentials',
    'Use this template for custom projects that need a clean slate. Includes Vite, TypeScript, and basic styling.',
    '/srv/webalive/sites/blank.alive.best',
    'https://blank.alive.best',
    true
  ),
  (
    'Portfolio',
    'A modern portfolio template for showcasing your work',
    'Perfect for designers, developers, and creatives who want to showcase their projects and skills. Includes gallery, about section, and contact form.',
    '/srv/webalive/sites/template1.alive.best',
    'https://template1.alive.best',
    true
  ),
  (
    'Landing Page',
    'A conversion-focused landing page template',
    'Great for product launches, SaaS marketing, or service businesses. Includes hero section, features, pricing, and CTA blocks.',
    '/srv/webalive/sites/one.goalive.nl',
    'https://one.goalive.nl',
    true
  ),
  (
    'Event',
    'Event and conference website template',
    'Ideal for events, conferences, workshops, or meetups. Includes schedule, speakers, venue info, and registration.',
    '/srv/webalive/sites/four.goalive.nl',
    'https://four.goalive.nl',
    true
  ),
  (
    'Business',
    'Professional business website template',
    'Suitable for local businesses, agencies, or professional services. Includes service pages, team section, and contact information.',
    '/srv/webalive/sites/loodgieter.alive.best',
    'https://loodgieter.alive.best',
    true
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Default Server
-- ============================================================================
-- Register the default server for site deployments

INSERT INTO app.servers (server_id, name, ip, hostname)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Primary Server',
  '127.0.0.1',  -- Update with your server's IP
  'localhost'   -- Update with your server's hostname
)
ON CONFLICT (server_id) DO UPDATE SET
  name = EXCLUDED.name,
  ip = EXCLUDED.ip,
  hostname = EXCLUDED.hostname;

-- ============================================================================
-- Functions
-- ============================================================================
-- Helper functions for the application

-- Function to atomically deduct credits from an org
CREATE OR REPLACE FUNCTION iam.deduct_credits(p_org_id UUID, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE iam.orgs
  SET credits = credits - p_amount,
      updated_at = NOW()
  WHERE org_id = p_org_id
    AND credits >= p_amount
  RETURNING credits INTO v_new_balance;

  RETURN v_new_balance;  -- Returns NULL if insufficient credits
END;
$$ LANGUAGE plpgsql;

-- Function to add credits to an org
CREATE OR REPLACE FUNCTION iam.add_credits(p_org_id UUID, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE iam.orgs
  SET credits = credits + p_amount,
      updated_at = NOW()
  WHERE org_id = p_org_id
  RETURNING credits INTO v_new_balance;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to generate a unique invite code
CREATE OR REPLACE FUNCTION iam.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code
    v_code := upper(substring(encode(gen_random_bytes(4), 'base64') from 1 for 6));
    -- Remove confusing characters
    v_code := replace(replace(replace(replace(v_code, 'O', 'X'), '0', 'Y'), 'I', 'Z'), 'L', 'W');

    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM iam.users WHERE invite_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create invite code for a user
CREATE OR REPLACE FUNCTION iam.get_or_create_invite_code(p_user_id UUID, p_new_code TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_existing_code TEXT;
  v_new_code TEXT;
BEGIN
  -- Check for existing code
  SELECT invite_code INTO v_existing_code
  FROM iam.users
  WHERE user_id = p_user_id;

  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;
  END IF;

  -- Generate or use provided code
  v_new_code := COALESCE(p_new_code, iam.generate_invite_code());

  -- Update user with new code
  UPDATE iam.users
  SET invite_code = v_new_code,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to validate a bearer token
CREATE OR REPLACE FUNCTION lockbox.validate_bearer_token(p_secret_hash TEXT)
RETURNS TABLE(secret_id UUID, clerk_id TEXT, scopes JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sk.secret_id,
    sk.user_id as clerk_id,
    sk.scopes
  FROM lockbox.secret_keys sk
  WHERE sk.secret_hash = p_secret_hash
    AND sk.revoked_at IS NULL
    AND (sk.expires_at IS NULL OR sk.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Success Message
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Initial seed data applied successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Update app.servers with your actual server IP';
  RAISE NOTICE '  2. Update app.templates source_path for your environment';
  RAISE NOTICE '  3. Configure integration providers in the dashboard';
END $$;
