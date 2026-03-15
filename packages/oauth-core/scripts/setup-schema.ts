#!/usr/bin/env bun
/**
 * Lockbox Schema Setup - Programmatic Version
 *
 * Bootstraps the current lockbox schema used by @webalive/oauth-core:
 * - lockbox.user_secrets
 * - public lockbox RPC functions
 * - indexes, triggers, and grants
 *
 * Uses Supabase Management API to execute DDL.
 */

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!SUPABASE_PROJECT_ID || !SUPABASE_ACCESS_TOKEN) {
  console.error("❌ Missing required environment variables:")
  console.error("   - SUPABASE_PROJECT_ID")
  console.error("   - SUPABASE_ACCESS_TOKEN")
  console.error("\nGet these from: https://supabase.com/dashboard/project/_/settings/api")
  process.exit(1)
}

async function executeSql(query: string) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`SQL query failed: ${JSON.stringify(error, null, 2)}`)
  }

  return response.json()
}

async function setupSchema() {
  console.log("🔐 Setting up Lockbox Schema\n")
  console.log("=====================================\n")

  try {
    // 1. Enable required extensions
    console.log("1️⃣  Enabling required extensions...")
    await executeSql('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    await executeSql('CREATE EXTENSION IF NOT EXISTS "citext"')
    console.log("✅ Extensions enabled\n")

    // 2. Create lockbox schema
    console.log("2️⃣  Creating lockbox schema...")
    await executeSql("CREATE SCHEMA IF NOT EXISTS lockbox")
    console.log("✅ Schema created\n")

    // 3. Create helper function used by triggers
    console.log("3️⃣  Creating helper functions...")
    await executeSql(`
      CREATE OR REPLACE FUNCTION lockbox.tg_set_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path TO 'lockbox', 'public'
      AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;
    `)
    console.log("✅ Helper functions created\n")

    // 4. Create user_secrets table
    console.log("4️⃣  Creating user_secrets table...")
    await executeSql(`
      CREATE TABLE IF NOT EXISTS lockbox.user_secrets (
        user_secret_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES iam.users(user_id) ON DELETE CASCADE,
        instance_id TEXT NOT NULL DEFAULT 'default',
        namespace TEXT NOT NULL DEFAULT 'default',
        name CITEXT NOT NULL CHECK ((char_length(name::text) >= 1) AND (char_length(name::text) <= 128)),
        ciphertext BYTEA NOT NULL,
        iv BYTEA NOT NULL CHECK (octet_length(iv) = 12),
        auth_tag BYTEA NOT NULL CHECK (octet_length(auth_tag) = 16),
        scope JSONB NOT NULL DEFAULT '{}'::jsonb,
        version INTEGER NOT NULL DEFAULT 1,
        is_current BOOLEAN NOT NULL DEFAULT true,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by TEXT,
        updated_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT user_secrets_version_check CHECK (version > 0)
      )
    `)
    console.log("✅ Table created\n")

    // 5. Create indexes
    console.log("5️⃣  Creating indexes...")
    await executeSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_secrets_instance_version_idx
        ON lockbox.user_secrets(user_id, instance_id, namespace, name, version DESC)
    `)
    await executeSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_secrets_one_current_per_instance_idx
        ON lockbox.user_secrets(user_id, instance_id, namespace, name)
        WHERE is_current = true
    `)
    await executeSql(`
      CREATE INDEX IF NOT EXISTS idx_user_secrets_expires_at
        ON lockbox.user_secrets(expires_at)
        WHERE expires_at IS NOT NULL
    `)
    console.log("✅ Indexes created\n")

    // 6. Enable RLS
    console.log("6️⃣  Enabling Row Level Security...")
    await executeSql("ALTER TABLE lockbox.user_secrets ENABLE ROW LEVEL SECURITY")
    console.log("✅ RLS enabled\n")

    // 7. Create RLS policy
    console.log("7️⃣  Creating RLS policies...")
    await executeSql(`
      DROP POLICY IF EXISTS rls_user_secrets_select_self ON lockbox.user_secrets
    `)
    await executeSql(`
      CREATE POLICY rls_user_secrets_select_self
        ON lockbox.user_secrets FOR SELECT
        USING (user_id = public.sub())
    `)
    console.log("✅ Policies created\n")

    // 8. Create updated_at trigger
    console.log("8️⃣  Creating triggers...")
    await executeSql(`
      DROP TRIGGER IF EXISTS set_updated_at ON lockbox.user_secrets
    `)

    await executeSql(`
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON lockbox.user_secrets
        FOR EACH ROW
        EXECUTE FUNCTION lockbox.tg_set_updated_at()
    `)
    console.log("✅ Triggers created\n")

    // 9. Create public RPCs used by oauth-core
    console.log("9️⃣  Creating public lockbox RPCs...")
    await executeSql(`
      CREATE OR REPLACE FUNCTION public.lockbox_get(
        p_user_id text,
        p_instance_id text,
        p_namespace text,
        p_name text
      )
      RETURNS TABLE(ciphertext bytea, iv bytea, auth_tag bytea)
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO ''
      AS $$
      BEGIN
        RETURN QUERY
        SELECT us.ciphertext, us.iv, us.auth_tag
        FROM lockbox.user_secrets us
        WHERE us.user_id = p_user_id
          AND us.instance_id = p_instance_id
          AND us.namespace = p_namespace
          AND us.name = p_name
          AND us.is_current = true
        LIMIT 1;
      END;
      $$;
    `)
    await executeSql(`
      CREATE OR REPLACE FUNCTION public.lockbox_save(
        p_user_id text,
        p_instance_id text,
        p_namespace text,
        p_name text,
        p_ciphertext bytea,
        p_iv bytea,
        p_auth_tag bytea,
        p_expires_at timestamptz DEFAULT NULL
      )
      RETURNS uuid
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO ''
      AS $$
      DECLARE
        v_next_version integer;
        v_new_id uuid;
      BEGIN
        SELECT COALESCE(MAX(us.version), 0) + 1
        INTO v_next_version
        FROM lockbox.user_secrets us
        WHERE us.user_id = p_user_id
          AND us.instance_id = p_instance_id
          AND us.namespace = p_namespace
          AND us.name = p_name;

        UPDATE lockbox.user_secrets
        SET is_current = false,
            updated_at = now(),
            updated_by = p_user_id
        WHERE user_id = p_user_id
          AND instance_id = p_instance_id
          AND namespace = p_namespace
          AND name = p_name
          AND is_current = true;

        INSERT INTO lockbox.user_secrets (
          user_id, instance_id, namespace, name,
          ciphertext, iv, auth_tag,
          version, is_current, expires_at,
          created_by, updated_by
        ) VALUES (
          p_user_id, p_instance_id, p_namespace, p_name,
          p_ciphertext, p_iv, p_auth_tag,
          v_next_version, true, p_expires_at,
          p_user_id, p_user_id
        )
        RETURNING user_secret_id INTO v_new_id;

        RETURN v_new_id;
      END;
      $$;
    `)
    await executeSql(`
      CREATE OR REPLACE FUNCTION public.lockbox_delete(
        p_user_id text,
        p_instance_id text,
        p_namespace text,
        p_name text
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO ''
      AS $$
      BEGIN
        DELETE FROM lockbox.user_secrets
        WHERE user_id = p_user_id
          AND instance_id = p_instance_id
          AND namespace = p_namespace
          AND name = p_name;
      END;
      $$;
    `)
    await executeSql(`
      CREATE OR REPLACE FUNCTION public.lockbox_list(
        p_user_id text,
        p_instance_id text,
        p_namespace text
      )
      RETURNS TABLE(
        user_secret_id uuid,
        user_id text,
        instance_id text,
        namespace text,
        name citext,
        ciphertext bytea,
        iv bytea,
        auth_tag bytea,
        version integer,
        is_current boolean,
        scope jsonb,
        expires_at timestamptz,
        last_used_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz,
        updated_at timestamptz,
        created_by text,
        updated_by text
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO ''
      AS $$
      BEGIN
        RETURN QUERY
        SELECT us.user_secret_id, us.user_id, us.instance_id, us.namespace, us.name,
               us.ciphertext, us.iv, us.auth_tag,
               us.version, us.is_current, us.scope,
               us.expires_at, us.last_used_at, us.deleted_at,
               us.created_at, us.updated_at, us.created_by, us.updated_by
        FROM lockbox.user_secrets us
        WHERE us.user_id = p_user_id
          AND us.instance_id = p_instance_id
          AND us.namespace = p_namespace
          AND us.is_current = true
        ORDER BY us.created_at DESC;
      END;
      $$;
    `)
    await executeSql(`
      CREATE OR REPLACE FUNCTION public.lockbox_exists(
        p_user_id text,
        p_instance_id text,
        p_namespace text,
        p_name text
      )
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO ''
      AS $$
      DECLARE
        v_exists boolean;
      BEGIN
        SELECT EXISTS(
          SELECT 1
          FROM lockbox.user_secrets us
          WHERE us.user_id = p_user_id
            AND us.instance_id = p_instance_id
            AND us.namespace = p_namespace
            AND us.name = p_name
            AND us.is_current = true
        ) INTO v_exists;

        RETURN v_exists;
      END;
      $$;
    `)
    console.log("✅ RPCs created\n")

    // 10. Grant permissions
    console.log("🔟  Granting permissions...")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_get(text, text, text, text) FROM PUBLIC")
    await executeSql(
      "REVOKE ALL ON FUNCTION public.lockbox_save(text, text, text, text, bytea, bytea, bytea, timestamptz) FROM PUBLIC",
    )
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_delete(text, text, text, text) FROM PUBLIC")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_list(text, text, text) FROM PUBLIC")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_exists(text, text, text, text) FROM PUBLIC")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_get(text, text, text, text) FROM anon")
    await executeSql(
      "REVOKE ALL ON FUNCTION public.lockbox_save(text, text, text, text, bytea, bytea, bytea, timestamptz) FROM anon",
    )
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_delete(text, text, text, text) FROM anon")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_list(text, text, text) FROM anon")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_exists(text, text, text, text) FROM anon")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_get(text, text, text, text) FROM authenticated")
    await executeSql(
      "REVOKE ALL ON FUNCTION public.lockbox_save(text, text, text, text, bytea, bytea, bytea, timestamptz) FROM authenticated",
    )
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_delete(text, text, text, text) FROM authenticated")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_list(text, text, text) FROM authenticated")
    await executeSql("REVOKE ALL ON FUNCTION public.lockbox_exists(text, text, text, text) FROM authenticated")
    await executeSql("GRANT USAGE ON SCHEMA lockbox TO service_role")
    await executeSql("GRANT ALL ON lockbox.user_secrets TO service_role")
    await executeSql("GRANT EXECUTE ON FUNCTION public.lockbox_get(text, text, text, text) TO service_role")
    await executeSql(
      "GRANT EXECUTE ON FUNCTION public.lockbox_save(text, text, text, text, bytea, bytea, bytea, timestamptz) TO service_role",
    )
    await executeSql("GRANT EXECUTE ON FUNCTION public.lockbox_delete(text, text, text, text) TO service_role")
    await executeSql("GRANT EXECUTE ON FUNCTION public.lockbox_list(text, text, text) TO service_role")
    await executeSql("GRANT EXECUTE ON FUNCTION public.lockbox_exists(text, text, text, text) TO service_role")
    console.log("✅ Permissions granted\n")

    // 11. Add comments
    console.log("1️⃣1️⃣  Adding documentation...")
    await executeSql(
      "COMMENT ON TABLE lockbox.user_secrets IS 'Encrypted OAuth and user secret storage using AES-256-GCM'",
    )
    await executeSql(
      "COMMENT ON COLUMN lockbox.user_secrets.namespace IS 'Type of secret: provider_config, oauth_connections, user_env_keys, or legacy oauth_tokens'",
    )
    await executeSql("COMMENT ON COLUMN lockbox.user_secrets.iv IS 'Initialization vector for AES-256-GCM (12 bytes)'")
    await executeSql("COMMENT ON COLUMN lockbox.user_secrets.auth_tag IS 'Authentication tag for AEAD (16 bytes)'")
    await executeSql(
      "COMMENT ON COLUMN lockbox.user_secrets.instance_id IS 'OAuth instance identifier for environment and tenant isolation'",
    )
    await executeSql(
      "COMMENT ON COLUMN lockbox.user_secrets.is_current IS 'Used for secret rotation - only one current row per user/instance/namespace/name'",
    )
    console.log("✅ Documentation added\n")

    // Success
    console.log("=====================================")
    console.log("🎉 LOCKBOX SCHEMA SETUP COMPLETE! 🎉")
    console.log("=====================================\n")

    console.log("Next steps:")
    console.log("1. Set LOCKBOX_MASTER_KEY: openssl rand -hex 32")
    console.log("2. Run: bun run verify")
    console.log("3. Integrate with apps/web\n")
  } catch (error) {
    console.error("\n❌ SCHEMA SETUP FAILED\n")
    console.error("Error:", error instanceof Error ? error.message : error)
    console.error("\nStack trace:", error instanceof Error ? error.stack : "")
    process.exit(1)
  }
}

// Run setup
setupSchema()
