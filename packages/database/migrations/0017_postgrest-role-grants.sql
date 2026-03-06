-- Ensure PostgREST runtime roles can actually reach Alive schemas on fresh
-- self-hosted Supabase databases.
--
-- Managed Supabase instances effectively provide these grants, but isolated
-- self-hosted E2E databases start without them. That leaves `service_role`
-- unable to bootstrap tenants and `authenticated` unable to traverse non-public
-- schemas even when table-level grants exist.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app, iam, integrations, lockbox TO authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, app, iam, integrations, lockbox TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, app, iam, integrations, lockbox TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, app, iam, integrations, lockbox TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, iam, integrations, lockbox
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, iam, integrations, lockbox
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, iam, integrations, lockbox
  GRANT EXECUTE ON FUNCTIONS TO service_role;
