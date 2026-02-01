-- Add GitHub as an integration provider
-- Run this in Supabase SQL Editor or via psql

-- 1. Insert the GitHub provider
INSERT INTO integrations.providers (
  provider_key,
  display_name,
  visibility_level,
  is_active,
  logo_path
) VALUES (
  'github',
  'GitHub',
  'beta',  -- Start with beta, can upgrade to 'public' later
  true,
  '/integrations/github.svg'
)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_active = EXCLUDED.is_active,
  logo_path = EXCLUDED.logo_path;

-- 2. Grant access to the platform owner (eedenlars@gmail.com)
INSERT INTO integrations.access_policies (provider_id, user_id)
SELECT p.provider_id, u.user_id
FROM integrations.providers p
JOIN iam.users u ON u.email = 'eedenlars@gmail.com'
WHERE p.provider_key = 'github'
ON CONFLICT (provider_id, user_id) DO NOTHING;

-- 3. Verify the insert
SELECT
  p.provider_key,
  p.display_name,
  p.visibility_level,
  p.is_active,
  p.logo_path,
  (SELECT COUNT(*) FROM integrations.access_policies ap WHERE ap.provider_id = p.provider_id) as policy_count
FROM integrations.providers p
WHERE p.provider_key = 'github';
