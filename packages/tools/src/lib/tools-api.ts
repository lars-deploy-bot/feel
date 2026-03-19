/**
 * Typed API client for MCP tools → API server calls.
 *
 * Uses @alive-brug/alrighty createClient with a subset of the API schemas.
 * The server validates the same shapes via handleBody/alrighty.
 */

import { ApiError, createClient, type Req } from "@alive-brug/alrighty"
import { CLAUDE_MODELS, COOKIE_NAMES } from "@webalive/shared"
import { z } from "zod"
import { getApiBaseUrl } from "./api-client.js"

// ---------------------------------------------------------------------------
// Schemas — subset matching the API routes that MCP tools call.
// The server validates the same shapes via handleBody/alrighty.
//
// Route mapping rules (important for AI-generated code):
// 1) `pathOverride` at callsite (highest priority, used for dynamic routes)
// 2) schema `path` field (for key/route mismatches like "automations/create" -> /api/automations)
// 3) fallback to `/api/${schemaKey}`
// ---------------------------------------------------------------------------

const ClaudeModelSchema = z.enum(Object.values(CLAUDE_MODELS) as [string, ...string[]])
const ToolCreateTriggerTypeSchema = z.enum(["cron", "one-time"])
const ToolCreateActionTypeSchema = z.enum(["prompt"])

export const toolsSchemas = {
  /** GET /api/automations */
  automations: {
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
    // Schema key is a lookup identifier; actual route is /api/automations.
    // This prevents accidental /api/automations/create requests when callers omit pathOverride.
    path: "automations",
    req: z
      .object({
        site_id: z.string().min(1),
        name: z.string().min(1),
        // Intentionally narrower than the server schema: MCP create_automation
        // currently supports only schedule-based prompt jobs.
        trigger_type: ToolCreateTriggerTypeSchema,
        action_type: ToolCreateActionTypeSchema,
        action_prompt: z.string().nullable().optional(),
        schedule_text: z.string().nullable().optional(),
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
    // Dynamic route: caller must pass pathOverride with the concrete automation ID.
    req: z.undefined().brand<"AutomationsTriggerRequest">(),
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
let _clientCacheKey: string | null = null

function getClient(): ToolsClient {
  const basePath = `${getApiBaseUrl()}/api`
  const sessionCookie = process.env.ALIVE_SESSION_COOKIE?.trim() || undefined
  const cacheKey = `${basePath}|${sessionCookie ?? ""}`

  if (_client && _clientCacheKey === cacheKey) {
    return _client
  }

  const headers: Record<string, string> = {}
  if (sessionCookie) {
    headers.Cookie = `${COOKIE_NAMES.SESSION}=${sessionCookie}`
  }

  _client = createClient(toolsSchemas, {
    basePath,
    credentials: "omit",
    headers,
  })
  _clientCacheKey = cacheKey

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
type ToolsReqEndpoint = {
  [K in ToolsEndpoint]: "req" extends keyof (typeof toolsSchemas)[K] ? K : never
}[ToolsEndpoint]
type ToolsReq<E extends ToolsReqEndpoint> = Req<typeof toolsSchemas, E>

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
// eslint-disable-next-line -- Generic index lookup requires assertion: Zod parse guarantees the shape matches ToolsReq<E>
export function validateToolsRequest<E extends ToolsReqEndpoint>(endpoint: E, data: unknown): ToolsReq<E> {
  const entry = toolsSchemas[endpoint]
  if (!("req" in entry) || !entry.req) throw new Error(`Endpoint "${endpoint}" has no request schema`)
  return entry.req.parse(data) as ToolsReq<E>
}

export { ApiError }
