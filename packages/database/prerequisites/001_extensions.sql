-- Prerequisites for self-hosted Supabase (PG 13+)
-- Supabase Cloud has these pre-configured; self-hosted instances need them
-- before migrations can run.
--
-- Safe to run on any Postgres — uses IF NOT EXISTS everywhere.

-- Extensions schema (Supabase convention: extensions live here, not in public)
CREATE SCHEMA IF NOT EXISTS extensions;

-- pgcrypto: gen_random_bytes() used by gen_prefixed_id() and webhook secrets
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- citext: case-insensitive text for email columns
CREATE EXTENSION IF NOT EXISTS citext SCHEMA extensions;

-- uuid-ossp: uuid generation helpers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- search_path: allow unqualified citext/uuid references in migrations
ALTER DATABASE postgres SET search_path TO public, extensions;
SET search_path TO public, extensions;
