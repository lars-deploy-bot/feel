-- Required reference data: the "alive" domain entry
-- This is the synthetic domain for the superadmin workspace (SUPERADMIN.WORKSPACE_NAME = "alive").
-- Without this row, /api/sites returns 500 for superadmins and automations can't target the alive workspace.
--
-- The org/server must exist first (001_servers.sql + runtime user creation).
-- This seed creates a placeholder org for the alive workspace if one doesn't exist,
-- then links the domain. Port 0 = not a real site (no Caddy routing needed).
--
-- On fresh databases, this creates a bootstrap org. On existing databases where
-- the alive domain already exists (e.g. linked to a real user's org), this is a no-op.

DO $$
DECLARE
  v_org_id text;
  v_server_id text;
BEGIN
  -- Use the first available server
  SELECT server_id INTO v_server_id FROM app.servers LIMIT 1;
  IF v_server_id IS NULL THEN
    RAISE NOTICE 'No servers found — skipping alive workspace seed. Run 001_servers.sql first.';
    RETURN;
  END IF;

  -- Check if alive domain already exists
  IF EXISTS (SELECT 1 FROM app.domains WHERE hostname = 'alive') THEN
    RAISE NOTICE 'alive domain already exists — skipping.';
    RETURN;
  END IF;

  -- Create bootstrap org if needed
  IF NOT EXISTS (SELECT 1 FROM iam.orgs WHERE org_id = 'org_alive_bootstrap') THEN
    INSERT INTO iam.orgs (org_id, name, credits) VALUES ('org_alive_bootstrap', 'Alive Bootstrap', 0);
  END IF;

  INSERT INTO app.domains (hostname, port, org_id, server_id)
  VALUES ('alive', 0, 'org_alive_bootstrap', v_server_id);

  RAISE NOTICE 'Created alive domain entry with bootstrap org on server %', v_server_id;
END $$;
