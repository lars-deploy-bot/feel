-- ============================================================================
-- Core Database Functions
-- ============================================================================
-- Run this BEFORE running migrations to ensure all functions are available.
-- These functions are required for default values and RLS policies.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- gen_prefixed_id - Generate prefixed unique IDs
-- ============================================================================
-- Creates IDs like 'user_1a2b3c4d5e6f7890', 'org_1a2b3c4d5e6f7890'

CREATE OR REPLACE FUNCTION public.gen_prefixed_id(p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    rnd text := substr(encode(gen_random_bytes(8), 'hex'), 1, 16); -- 16 hex chars
    norm_prefix text := CASE WHEN right(p_prefix, 1) = '_' THEN p_prefix ELSE p_prefix || '_' END;
BEGIN
    RETURN norm_prefix || rnd;
END;
$$;

COMMENT ON FUNCTION public.gen_prefixed_id(text) IS 'Generate a prefixed unique ID (e.g., user_1a2b3c4d5e6f7890)';

-- ============================================================================
-- sub - Get current user ID from JWT claims
-- ============================================================================
-- Used in RLS policies to identify the current user

CREATE OR REPLACE FUNCTION public.sub()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
    v_sub text;
    v_claims json;
BEGIN
    -- Try reading from actual JWT (real requests via Supabase)
    BEGIN
        v_sub := NULLIF((auth.jwt())->>'sub', '');
    EXCEPTION WHEN undefined_function THEN
        v_sub := NULL;
    END;

    -- If no JWT, try reading from request.jwt.claims (for testing/RLS simulation)
    IF v_sub IS NULL THEN
        BEGIN
            v_claims := current_setting('request.jwt.claims', true)::json;
            v_sub := NULLIF(v_claims->>'sub', '');
        EXCEPTION WHEN OTHERS THEN
            v_sub := NULL;
        END;
    END IF;

    RETURN v_sub;
END
$$;

COMMENT ON FUNCTION public.sub() IS 'Get the current user ID from JWT claims';

-- ============================================================================
-- IAM Schema Functions
-- ============================================================================

-- Schema-local wrapper for sub()
CREATE OR REPLACE FUNCTION iam.sub()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT public.sub();
$$;

-- Schema-local wrapper for sub() in app schema
CREATE OR REPLACE FUNCTION app.sub()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT public.sub();
$$;

-- set_updated_at - Trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION iam.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- is_org_member - Check if current user is a member of an org
CREATE OR REPLACE FUNCTION iam.is_org_member(p_org_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'iam'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM iam.org_memberships m
        WHERE m.org_id = p_org_id
          AND m.user_id = public.sub()
    )
$$;

-- is_org_admin - Check if current user is an admin (or owner) of an org
CREATE OR REPLACE FUNCTION iam.is_org_admin(p_org_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'iam'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM iam.org_memberships m
        WHERE m.org_id = p_org_id
          AND m.user_id = public.sub()
          AND m.role IN ('owner', 'admin')
    )
$$;

-- deduct_credits - Atomically deduct credits from an org
CREATE OR REPLACE FUNCTION iam.deduct_credits(p_org_id text, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_balance numeric;
BEGIN
    UPDATE iam.orgs
    SET credits = credits - p_amount,
        updated_at = now()
    WHERE org_id = p_org_id
      AND credits >= p_amount
    RETURNING credits INTO v_new_balance;

    RETURN v_new_balance;
END;
$$;

-- add_credits - Add credits to an org
CREATE OR REPLACE FUNCTION iam.add_credits(p_org_id text, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_balance numeric;
BEGIN
    UPDATE iam.orgs
    SET credits = credits + p_amount,
        updated_at = now()
    WHERE org_id = p_org_id
    RETURNING credits INTO v_new_balance;

    RETURN v_new_balance;
END;
$$;

-- generate_invite_code - Generate a unique invite code
CREATE OR REPLACE FUNCTION iam.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
END;
$$;

-- set_invite_code - Trigger to auto-set invite code on user insert
CREATE OR REPLACE FUNCTION iam.set_invite_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.invite_code IS NULL THEN
        NEW.invite_code := iam.generate_invite_code();
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- App Schema Functions
-- ============================================================================

-- update_updated_at - App schema version of updated_at trigger
CREATE OR REPLACE FUNCTION app.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- Lockbox Schema Functions
-- ============================================================================

-- tg_set_updated_at - Lockbox version of updated_at trigger
CREATE OR REPLACE FUNCTION lockbox.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Note: These triggers are created after tables exist.
-- Run after migrations if tables don't have triggers yet.

-- IAM triggers (run manually after table creation if needed)
-- CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON iam.users FOR EACH ROW EXECUTE FUNCTION iam.set_updated_at();
-- CREATE TRIGGER trg_users_set_invite_code BEFORE INSERT ON iam.users FOR EACH ROW EXECUTE FUNCTION iam.set_invite_code();
-- CREATE TRIGGER set_orgs_updated_at BEFORE UPDATE ON iam.orgs FOR EACH ROW EXECUTE FUNCTION iam.set_updated_at();
-- CREATE TRIGGER set_org_memberships_updated_at BEFORE UPDATE ON iam.org_memberships FOR EACH ROW EXECUTE FUNCTION iam.set_updated_at();

-- App triggers (run manually after table creation if needed)
-- CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON app.conversations FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

-- Lockbox triggers (run manually after table creation if needed)
-- CREATE TRIGGER set_updated_at BEFORE UPDATE ON lockbox.user_secrets FOR EACH ROW EXECUTE FUNCTION lockbox.tg_set_updated_at();
