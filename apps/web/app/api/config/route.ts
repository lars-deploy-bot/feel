/**
 * Runtime Configuration Endpoint
 *
 * Returns client-safe config values read at request time from the validated
 * env object AND server-config.json. This allows changing PostHog keys,
 * Sentry DSN, contact email, etc. without a full rebuild.
 *
 * GET /api/config — no auth required (all values are public/client-safe).
 * Cache-Control: public, max-age=300 (5 minutes).
 *
 * NEVER expose server secrets here (service role keys, JWT secret, API keys, etc.).
 */

import { env } from "@webalive/env/server"
import { CONTACT_EMAIL, DEFAULTS, DOMAINS, SENTRY } from "@webalive/shared"

export interface RuntimeConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  posthogKey: string
  posthogHost: string
  sentryDsn: string
  contactEmail: string
  serverIp: string
  previewBase: string
  aliveEnv: string
}

export function GET(): Response {
  const config: RuntimeConfig = {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    posthogKey: env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
    posthogHost: env.NEXT_PUBLIC_POSTHOG_HOST ?? "",
    sentryDsn: SENTRY.DSN,
    contactEmail: CONTACT_EMAIL,
    serverIp: DEFAULTS.SERVER_IP,
    previewBase: DOMAINS.PREVIEW_BASE,
    aliveEnv: env.ALIVE_ENV ?? "",
  }

  return Response.json(config, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  })
}
