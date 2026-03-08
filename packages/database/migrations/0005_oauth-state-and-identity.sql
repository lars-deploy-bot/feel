-- OAuth State Lifecycle + External Identity Conflict Detection
-- Part of OAuth Hardening Phase 2 (Epic #132)
--
-- Creates:
-- 1. integrations.oauth_states — server-side CSRF state records with TTL
-- 2. integrations.oauth_external_identities — maps provider accounts to internal users
-- 3. RPCs: create_oauth_state, consume_oauth_state, upsert_oauth_identity

-- ============================================================================
-- TABLE: integrations.oauth_states
-- Server-side OAuth state records replacing cookie-only CSRF protection
-- ============================================================================

CREATE TABLE integrations.oauth_states (
    state_id uuid DEFAULT extensions.gen_random_uuid() PRIMARY KEY NOT NULL,
    state_hash text NOT NULL,
    provider text NOT NULL,
    user_id text NOT NULL REFERENCES iam.users(user_id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz
);

CREATE UNIQUE INDEX idx_oauth_states_hash ON integrations.oauth_states (state_hash);
CREATE INDEX idx_oauth_states_user_provider ON integrations.oauth_states (user_id, provider);

-- ============================================================================
-- TABLE: integrations.oauth_external_identities
-- Maps external provider accounts to internal users (conflict detection)
-- ============================================================================

CREATE TABLE integrations.oauth_external_identities (
    identity_id uuid DEFAULT extensions.gen_random_uuid() PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES iam.users(user_id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    provider_email text,
    first_connected_at timestamptz DEFAULT now() NOT NULL,
    last_connected_at timestamptz DEFAULT now() NOT NULL
);

-- One external account maps to exactly one internal user
CREATE UNIQUE INDEX idx_oauth_identities_provider_user
    ON integrations.oauth_external_identities (provider, provider_user_id);
CREATE INDEX idx_oauth_identities_user_provider
    ON integrations.oauth_external_identities (user_id, provider);

-- ============================================================================
-- RPC: create_oauth_state
-- Inserts a state record and prunes expired states for same user+provider
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_oauth_state(
    p_state_hash text,
    p_provider text,
    p_user_id text,
    p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_state_id uuid;
BEGIN
    -- Prune expired states for this user+provider (housekeeping)
    DELETE FROM integrations.oauth_states
    WHERE user_id = p_user_id
      AND provider = p_provider
      AND expires_at < now();

    -- Insert new state
    INSERT INTO integrations.oauth_states (state_hash, provider, user_id, expires_at)
    VALUES (p_state_hash, p_provider, p_user_id, p_expires_at)
    RETURNING state_id INTO v_state_id;

    RETURN v_state_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_oauth_state FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_oauth_state TO service_role;

-- ============================================================================
-- RPC: consume_oauth_state
-- Atomically validates and consumes a state token (one-time use)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_oauth_state(
    p_state_hash text
)
RETURNS TABLE (
    found boolean,
    valid boolean,
    user_id text,
    provider text,
    failure_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_row integrations.oauth_states%ROWTYPE;
BEGIN
    -- Lock the row for atomic consume
    SELECT * INTO v_row
    FROM integrations.oauth_states s
    WHERE s.state_hash = p_state_hash
    FOR UPDATE;

    IF v_row IS NULL THEN
        RETURN QUERY SELECT false, false, NULL::text, NULL::text, 'state_not_found'::text;
        RETURN;
    END IF;

    -- Check if already consumed (replay attack)
    IF v_row.consumed_at IS NOT NULL THEN
        RETURN QUERY SELECT true, false, v_row.user_id, v_row.provider, 'state_already_consumed'::text;
        RETURN;
    END IF;

    -- Check if expired
    IF v_row.expires_at < now() THEN
        RETURN QUERY SELECT true, false, v_row.user_id, v_row.provider, 'state_expired'::text;
        RETURN;
    END IF;

    -- Consume the state atomically
    UPDATE integrations.oauth_states
    SET consumed_at = now()
    WHERE state_id = v_row.state_id;

    RETURN QUERY SELECT true, true, v_row.user_id, v_row.provider, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_oauth_state FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_oauth_state TO service_role;

-- ============================================================================
-- RPC: upsert_oauth_identity
-- Upserts external identity, returns conflict if same provider account
-- is already linked to a different internal user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_oauth_identity(
    p_user_id text,
    p_provider text,
    p_provider_user_id text,
    p_provider_email text DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    conflict boolean,
    existing_user_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_existing_user_id text;
BEGIN
    -- Atomic upsert: the WHERE clause on DO UPDATE ensures we only update rows
    -- belonging to the same user. If a different user owns the row, the update
    -- is skipped and the CTE returns no rows — which we detect as a conflict.
    -- This eliminates the TOCTOU race in a SELECT-then-INSERT approach.
    WITH upserted AS (
        INSERT INTO integrations.oauth_external_identities
            (user_id, provider, provider_user_id, provider_email)
        VALUES
            (p_user_id, p_provider, p_provider_user_id, p_provider_email)
        ON CONFLICT (provider, provider_user_id)
        DO UPDATE SET
            last_connected_at = now(),
            provider_email = COALESCE(EXCLUDED.provider_email, integrations.oauth_external_identities.provider_email)
        WHERE integrations.oauth_external_identities.user_id = p_user_id
        RETURNING user_id
    )
    SELECT u.user_id INTO v_existing_user_id FROM upserted u;

    IF v_existing_user_id IS NOT NULL THEN
        -- Success: row was inserted or updated for the same user
        RETURN QUERY SELECT true, false, NULL::text;
        RETURN;
    END IF;

    -- No row returned → the ON CONFLICT WHERE clause rejected the update.
    -- Look up who actually owns this provider account.
    SELECT i.user_id INTO v_existing_user_id
    FROM integrations.oauth_external_identities i
    WHERE i.provider = p_provider
      AND i.provider_user_id = p_provider_user_id;

    RETURN QUERY SELECT false, true, v_existing_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_oauth_identity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_oauth_identity TO service_role;
