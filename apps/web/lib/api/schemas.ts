import { z } from "zod"

// ============================================================================
// STANDARDIZED RESPONSE ENVELOPES
// ============================================================================

/**
 * Generic success envelope { success: true, data: T }
 */
export const SuccessResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  })

/**
 * Generic error envelope { success: false, error: {...} }
 */
export const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.string().datetime().optional(),
  }),
})

/**
 * Union of success or error (common pattern in APIs)
 */
export const ApiResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.union([SuccessResponse(dataSchema), ErrorResponse])

// ============================================================================
// CLAUDE BRIDGE API SCHEMAS
// ============================================================================

/**
 * Centralized API schema registry for type-safe request/response handling
 *
 * Usage in route handlers:
 *   const parsed = await handleBody('login', req)
 *   return alrighty('login', { userId: '123' })
 *
 * Usage in client code:
 *   const data = await postty('login', { email, password })
 */
export const apiSchemas = {
  /**
   * POST /api/login
   * User authentication
   */
  login: {
    req: z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .brand<"LoginRequest">(),
    res: z.object({
      ok: z.boolean(),
      userId: z.string().optional(),
      error: z.string().optional(),
      message: z.string().optional(),
      requestId: z.string().optional(),
      details: z.unknown().optional(),
    }),
  },

  /**
   * GET /api/user
   * Get current authenticated user
   */
  user: {
    req: z.undefined().brand<"UserRequest">(), // GET has no body
    res: z.object({
      user: z
        .object({
          userId: z.string(),
          email: z.string().email(),
          displayName: z.string().optional(),
          workspaces: z.array(z.string()),
        })
        .nullable(),
    }),
  },

  /**
   * POST /api/feedback
   * Submit user feedback
   */
  feedback: {
    req: z
      .object({
        feedback: z.string().min(1).max(5000),
        email: z.string().email().optional(),
        workspace: z.string().optional(),
        conversationId: z.string().uuid().optional(),
        userAgent: z.string().optional(),
      })
      .brand<"FeedbackRequest">(),
    res: z.object({
      ok: z.boolean(),
      id: z.string().optional(),
      timestamp: z.string().optional(),
      error: z.string().optional(),
      message: z.string().optional(),
    }),
  },

  /**
   * POST /api/claude/stream/cancel
   * Cancel an active stream
   *
   * Two modes:
   * - Primary: Cancel by requestId (when X-Request-Id header was received)
   * - Fallback: Cancel by tabId + workspace (super-early Stop)
   *
   * Note: Schema is permissive - server does its own validation.
   * Either requestId OR (tabId + workspace) must be provided.
   */
  "claude/stream/cancel": {
    req: z
      .object({
        requestId: z.string().optional(),
        tabGroupId: z.string().optional(), // Tab group ID for lock key
        tabId: z.string().optional(), // Primary session key (replaces conversationId for fallback)
        workspace: z.string().optional(),
      })
      .refine(data => data.requestId || (data.tabGroupId && data.tabId && data.workspace), {
        message: "Either requestId or (tabGroupId + tabId + workspace) must be provided",
      })
      .brand<"CancelStreamRequest">(),
    res: z.object({
      ok: z.boolean(),
      status: z.enum(["cancelled", "already_complete"]),
      requestId: z.string().optional(),
      tabId: z.string().optional(),
    }),
  },
  /**
   * GET /api/manager/templates
   * Get all templates (manager auth required)
   */
  "manager/templates": {
    req: z.undefined().brand<"ManagerTemplatesGetRequest">(),
    res: z.object({
      ok: z.boolean(),
      templates: z.array(
        z.object({
          template_id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          ai_description: z.string().nullable(),
          source_path: z.string(),
          preview_url: z.string().nullable(),
          image_url: z.string().nullable(),
          is_active: z.boolean().nullable(),
          deploy_count: z.number().nullable(),
        }),
      ),
      count: z.number(),
    }),
  },

  /**
   * POST /api/manager/templates
   * Create a new template (manager auth required)
   */
  "manager/templates/create": {
    req: z
      .object({
        template_id: z.string().optional(),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        ai_description: z.string().nullable().optional(),
        source_path: z.string().min(1),
        preview_url: z.string().nullable().optional(),
        image_url: z.string().nullable().optional(),
        is_active: z.boolean().optional(),
      })
      .brand<"ManagerTemplatesCreateRequest">(),
    res: z.object({
      ok: z.boolean(),
      template: z.object({
        template_id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        ai_description: z.string().nullable(),
        source_path: z.string(),
        preview_url: z.string().nullable(),
        image_url: z.string().nullable(),
        is_active: z.boolean().nullable(),
        deploy_count: z.number().nullable(),
      }),
    }),
  },

  /**
   * PUT /api/manager/templates
   * Update an existing template (manager auth required)
   */
  "manager/templates/update": {
    req: z
      .object({
        template_id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        ai_description: z.string().nullable().optional(),
        source_path: z.string().optional(),
        preview_url: z.string().nullable().optional(),
        image_url: z.string().nullable().optional(),
        is_active: z.boolean().optional(),
        deploy_count: z.number().optional(),
      })
      .brand<"ManagerTemplatesUpdateRequest">(),
    res: z.object({
      ok: z.boolean(),
      template: z.object({
        template_id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        ai_description: z.string().nullable(),
        source_path: z.string(),
        preview_url: z.string().nullable(),
        image_url: z.string().nullable(),
        is_active: z.boolean().nullable(),
        deploy_count: z.number().nullable(),
      }),
    }),
  },

  /**
   * DELETE /api/manager/templates?template_id=xxx
   * Delete a template (manager auth required)
   */
  "manager/templates/delete": {
    req: z.undefined().brand<"ManagerTemplatesDeleteRequest">(),
    res: z.object({
      ok: z.boolean(),
      deleted: z.boolean(),
      template_id: z.string(),
    }),
  },
} as const

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Endpoint = keyof typeof apiSchemas
export type Req<E extends Endpoint> = z.infer<(typeof apiSchemas)[E]["req"]>
export type Res<E extends Endpoint> = z.infer<(typeof apiSchemas)[E]["res"]>

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Validates request data against the schema for the given endpoint.
 * Returns a branded type that can be passed to API functions.
 *
 * This is REQUIRED - you cannot pass raw objects to postty/putty.
 * The branded type ensures data has been validated.
 *
 * @example
 * ```typescript
 * // ❌ This won't compile:
 * await postty("login", { email: "test@example.com", password: "secret" })
 *
 * // ✅ This is required:
 * const validated = validateRequest("login", { email: "test@example.com", password: "secret" })
 * await postty("login", validated)
 * ```
 *
 * @throws {ZodError} If validation fails (invalid email, password too short, etc.)
 */
export function validateRequest<E extends Endpoint>(endpoint: E, data: unknown): Req<E> {
  const schema = apiSchemas[endpoint].req
  return schema.parse(data) as Req<E>
}
