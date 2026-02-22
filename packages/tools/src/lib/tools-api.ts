/**
 * Typed API client for MCP tools → API server calls.
 *
 * Uses @alive-brug/alrighty createClient with a subset of the API schemas.
 * The server validates the same shapes via handleBody/alrighty.
 */

import { ApiError, createClient, type Req } from "@alive-brug/alrighty"
import { CLAUDE_MODELS, COOKIE_NAMES } from "@webalive/shared"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Schemas — subset matching the API routes that MCP tools call.
// The server validates the same shapes via handleBody/alrighty.
// ---------------------------------------------------------------------------

const ClaudeModelSchema = z.enum(Object.values(CLAUDE_MODELS) as [string, ...string[]])
const TriggerTypeSchema = z.enum(["cron", "one-time", "email", "webhook"])

export const toolsSchemas = {
  /** GET /api/automations */
  automations: {
    req: z.undefined().brand<"AutomationsRequest">(),
    res: z.object({
      ok: z.literal(true),
      automations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          is_active: z.boolean(),
          trigger_type: z.string(),
          cron_schedule: z.string().nullable(),
          last_run_at: z.string().nullable(),
          last_run_status: z.string().nullable(),
          next_run_at: z.string().nullable(),
          hostname: z.string().optional(),
        }),
      ),
      total: z.number().optional(),
    }),
  },

  /** POST /api/automations */
  "automations/create": {
    req: z
      .object({
        site_id: z.string().min(1),
        name: z.string().min(1),
        trigger_type: TriggerTypeSchema,
        action_type: z.enum(["prompt", "sync", "publish"]),
        action_prompt: z.string().nullable().optional(),
        cron_schedule: z.string().nullable().optional(),
        cron_timezone: z.string().nullable().optional(),
        run_at: z.string().nullable().optional(),
        action_model: ClaudeModelSchema.nullable().optional(),
        skills: z.array(z.string()).optional().default([]),
        is_active: z.boolean().optional().default(true),
      })
      .brand<"AutomationsCreateRequest">(),
    res: z.object({
      ok: z.literal(true),
      automation: z.object({
        id: z.string(),
        name: z.string(),
        site_id: z.string(),
        trigger_type: z.string(),
        cron_schedule: z.string().nullable(),
        cron_timezone: z.string().nullable(),
        run_at: z.string().nullable(),
        is_active: z.boolean(),
        next_run_at: z.string().nullable(),
      }),
    }),
  },

  /** POST /api/automations/[id]/trigger (no body — ID is in URL path) */
  "automations/trigger": {
    req: z.object({}).brand<"AutomationsTriggerRequest">(),
    res: z.object({
      ok: z.literal(true),
      status: z.enum(["queued"]),
      startedAt: z.string(),
      timeoutSeconds: z.number(),
      monitor: z.object({
        runsPath: z.string(),
      }),
    }),
  },

  /** GET /api/sites */
  sites: {
    req: z.undefined().brand<"SitesRequest">(),
    res: z.object({
      ok: z.literal(true),
      sites: z.array(
        z.object({
          id: z.string(),
          hostname: z.string(),
          org_id: z.string(),
        }),
      ),
    }),
  },
} as const

// ---------------------------------------------------------------------------
// Lazy-initialized typed client
// ---------------------------------------------------------------------------

type ToolsClient = ReturnType<typeof createClient<typeof toolsSchemas>>

let _client: ToolsClient | null = null

function getApiBaseUrl(): string {
  const portEnv = process.env.PORT
  if (!portEnv) {
    throw new Error("PORT environment variable is required")
  }
  const port = Number.parseInt(portEnv.trim(), 10)
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT environment variable: must be an integer between 1 and 65535")
  }
  if (portEnv.trim() !== String(port)) {
    throw new Error("Invalid PORT environment variable: must be an integer between 1 and 65535")
  }
  return `http://localhost:${port}`
}

function getClient(): ToolsClient {
  if (_client) return _client

  const sessionCookie = process.env.ALIVE_SESSION_COOKIE
  const headers: Record<string, string> = {}
  if (sessionCookie) {
    headers.Cookie = `${COOKIE_NAMES.SESSION}=${sessionCookie}`
  }

  _client = createClient(toolsSchemas, {
    basePath: `${getApiBaseUrl()}/api`,
    credentials: "omit",
    headers,
  })

  return _client
}

/**
 * Get the typed API client.
 * Call `.getty()` / `.postty()` on the returned client.
 *
 * @example
 * ```typescript
 * const data = await api().getty("automations")
 * const result = await api().postty("automations/create", validated)
 * ```
 */
export function api(): ToolsClient {
  return getClient()
}

// ---------------------------------------------------------------------------
// Validation helper (required — raw objects won't satisfy brand types)
// ---------------------------------------------------------------------------

type ToolsEndpoint = keyof typeof toolsSchemas
type ToolsReq<E extends ToolsEndpoint> = Req<typeof toolsSchemas, E>

/**
 * Validate request data against the tools schema.
 * Returns a branded type that can be passed to postty/putty.
 *
 * @example
 * ```typescript
 * const validated = validateToolsRequest("automations/create", { site_id, name, ... })
 * const data = await api().postty("automations/create", validated)
 * ```
 */
export function validateToolsRequest<E extends ToolsEndpoint>(endpoint: E, data: unknown): ToolsReq<E> {
  const schema = toolsSchemas[endpoint].req
  return schema.parse(data) as ToolsReq<E>
}

export { ApiError }
