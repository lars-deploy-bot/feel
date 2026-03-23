import type {
  EndpointSchema,
  Params as PkgParams,
  Query as PkgQuery,
  Req as PkgReq,
  ReqInput as PkgReqInput,
  Res as PkgRes,
  ResPayload as PkgResPayload,
} from "@alive-brug/alrighty"
import { AppConstants, type TriggerType } from "@webalive/database"
import { AGENT_CONSTRAINTS, CLAUDE_MODELS, ORG_ROLES, RESERVED_USER_ENV_KEYS } from "@webalive/shared"
import { z } from "zod"
import {
  DeploySiteIdeasSchema,
  DeploySlugSchema,
  DeploySubdomainSchema,
  DeployTemplateIdSchema,
} from "@/features/deployment/types/guards"
import { CANCEL_ENDPOINT_STATUS_VALUES } from "@/lib/stream/cancel-status"
import { OptionalWorktreeSchema, OptionalWorktreeSlugSchema } from "@/types/guards/worktree-schemas"

// Re-export enum types so existing importers don't break
export type { ActionType, TriggerType } from "@webalive/database"

/** Zod schema for valid Claude model IDs, derived from the shared CLAUDE_MODELS constant */
const ClaudeModelSchema = z.enum(Object.values(CLAUDE_MODELS) as [string, ...string[]])

/**
 * Automation Zod schemas — all derived from DB-generated constants.
 *
 * Trigger categorization (schedule vs event) is business logic maintained here,
 * but validated against the DB enum via `satisfies`.
 */
const TriggerTypeSchema = z.enum(AppConstants.app.Enums.automation_trigger_type)

/** Schedule triggers: "cron" (recurring) | "one-time" (run once at a specific time) */
const SCHEDULE_TRIGGER_TYPES = ["cron", "one-time"] as const satisfies readonly TriggerType[]
export type ScheduleTriggerType = (typeof SCHEDULE_TRIGGER_TYPES)[number]
const SCHEDULE_TRIGGER_TYPE_SET: ReadonlySet<TriggerType> = new Set(SCHEDULE_TRIGGER_TYPES)

/** Event triggers: "email" (incoming email) | "webhook" (HTTP call) */
const EVENT_TRIGGER_TYPES = ["email", "webhook"] as const satisfies readonly TriggerType[]
export type EventTriggerType = (typeof EVENT_TRIGGER_TYPES)[number]

export function isScheduleTrigger(t: TriggerType): t is ScheduleTriggerType {
  return SCHEDULE_TRIGGER_TYPE_SET.has(t)
}

/** Action types (prompt, sync, publish) — derived from DB enum */
const ActionTypeSchema = z.enum(AppConstants.app.Enums.automation_action_type)

/** Job-level status (is the job idle, currently running, etc.) */
const AutomationJobStatusSchema = z.enum(AppConstants.app.Enums.automation_job_status)
export type AutomationJobStatus = z.infer<typeof AutomationJobStatusSchema>

/** Per-run status (did the run succeed, fail, etc.) */
const AutomationRunStatusSchema = z.enum(AppConstants.app.Enums.automation_run_status)
export type AutomationRunStatus = z.infer<typeof AutomationRunStatusSchema>
export const ExecutionModeSchema = z.enum(AppConstants.app.Enums.execution_mode)
const NewSiteSuccessResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string(),
  domain: z.string(),
  chatUrl: z.string(),
  orgId: z.string().optional(),
  executionMode: ExecutionModeSchema,
})
export const FilesUploadResponseSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  originalName: z.string(),
  size: z.number(),
  mimeType: z.string(),
})
export const FilesListResponseSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  workspace: z.string(),
  files: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["file", "directory"]),
      size: z.number(),
      modified: z.string(),
      path: z.string(),
    }),
  ),
})

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
        email: z.string().trim().toLowerCase().email(),
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
   * Returns full SessionUser object from getSessionUser()
   */
  user: {
    res: z.object({
      user: z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string().nullable(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        canSelectAnyModel: z.boolean(),
        isAdmin: z.boolean(),
        isSuperadmin: z.boolean(),
        enabledModels: z.array(z.string()),
      }),
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
        worktree: OptionalWorktreeSchema.optional(), // Validated to prevent session key corruption
        clientStack: z.string().optional(), // Debug: client-side stack trace for tracking cancel origin
      })
      .refine(data => data.requestId || (data.tabGroupId && data.tabId && data.workspace), {
        message: "Either requestId or (tabGroupId + tabId + workspace) must be provided",
      })
      .brand<"CancelStreamRequest">(),
    res: z.object({
      ok: z.boolean(),
      status: z.enum(CANCEL_ENDPOINT_STATUS_VALUES),
      requestId: z.string().optional(),
      tabId: z.string().optional(),
    }),
  },
  /**
   * GET /api/templates
   * Get active templates for this server (public, no auth)
   */
  templates: {
    res: z.object({
      templates: z.array(
        z.object({
          template_id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          ai_description: z.string().nullable(),
          preview_url: z.string().nullable(),
          image_url: z.string().nullable(),
          is_active: z.boolean().nullable(),
          deploy_count: z.number().nullable(),
        }),
      ),
    }),
  },

  /**
   * GET /api/manager/templates
   * Get all templates (manager auth required)
   */
  "manager/templates": {
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
    // Schema key is a lookup identifier; actual route is /api/manager/templates.
    path: "manager/templates",
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
    // Schema key is a lookup identifier; actual route is /api/manager/templates.
    path: "manager/templates",
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
    // Schema key is a lookup identifier; actual route is /api/manager/templates.
    // Note: callers still pass query params (e.g. ?template_id=...) via pathOverride.
    path: "manager/templates",
    req: z.undefined().brand<"ManagerTemplatesDeleteRequest">(),
    res: z.object({
      ok: z.boolean(),
      deleted: z.boolean(),
      template_id: z.string(),
    }),
  },
  // ============================================================================
  // MANAGER ENDPOINTS
  // ============================================================================

  /**
   * GET /api/manager/orgs
   * Get all organizations with members and domains (manager auth required)
   */
  "manager/orgs": {
    res: z.object({
      ok: z.literal(true),
      orgs: z.array(
        z.object({
          org_id: z.string(),
          name: z.string(),
          credits: z.number(),
          created_at: z.string(),
          updated_at: z.string().nullable().optional(),
          member_count: z.number(),
          domain_count: z.number(),
          members: z.array(
            z.object({
              user_id: z.string(),
              email: z.string(),
              display_name: z.string().nullable(),
              role: z.enum(ORG_ROLES),
              created_at: z.string().nullable(),
            }),
          ),
          domains: z.array(
            z.object({
              domain_id: z.string(),
              hostname: z.string(),
              port: z.number(),
              org_id: z.string().nullable(),
              server_id: z.string().nullable(),
              is_test_env: z.boolean(),
              test_run_id: z.string().nullable(),
              created_at: z.string(),
            }),
          ),
        }),
      ),
      feedback: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
  },

  // ============================================================================
  // AUTH ENDPOINTS (used by TanStack Query)
  // ============================================================================

  /**
   * GET /api/auth/organizations
   * Get user's organizations with workspace counts
   */
  "auth/organizations": {
    res: z.object({
      ok: z.literal(true),
      organizations: z.array(
        z.object({
          org_id: z.string(),
          name: z.string(),
          credits: z.number(),
          workspace_count: z.number(),
          role: z.enum(ORG_ROLES),
        }),
      ),
      current_user_id: z.string().optional(),
    }),
  },

  /**
   * GET /api/auth/all-workspaces
   * Get all workspaces for all orgs in one request
   */
  "auth/all-workspaces": {
    res: z.object({
      ok: z.literal(true),
      workspaces: z.record(z.string(), z.array(z.object({ hostname: z.string(), createdAt: z.string() }))),
    }),
  },

  /**
   * GET /api/auth/workspaces?org_id=xxx
   * Get workspaces for a specific org
   */
  "auth/workspaces": {
    query: z.object({
      org_id: z.string().min(1).optional(),
    }),
    res: z.object({
      ok: z.literal(true),
      workspaces: z.array(z.string()),
      sandboxed: z.array(z.string()).optional(),
    }),
  },

  /**
   * GET /api/auth/org-members?orgId=xxx
   * Get members of an organization
   */
  "auth/org-members": {
    query: z.object({
      orgId: z.string().min(1),
    }),
    res: z.object({
      ok: z.literal(true),
      members: z.array(
        z.object({
          user_id: z.string(),
          email: z.string(),
          display_name: z.string().nullable(),
          role: z.enum(ORG_ROLES),
        }),
      ),
    }),
  },

  /**
   * POST /api/auth/org-members
   * Add a member to an organization by email
   */
  "auth/org-members/create": {
    // Schema key is a lookup identifier; actual route is /api/auth/org-members.
    path: "auth/org-members",
    req: z
      .object({
        orgId: z.string().min(1),
        email: z.string().trim().toLowerCase().email(),
        role: z.enum(["member", "admin"]).default("member"),
      })
      .brand<"AuthOrgMembersCreateRequest">(),
    res: z.object({
      ok: z.literal(true),
      member: z.object({
        user_id: z.string(),
        email: z.string(),
        display_name: z.string().nullable(),
        role: z.enum(ORG_ROLES),
      }),
    }),
  },

  /**
   * DELETE /api/auth/org-members
   * Remove a member from an organization
   */
  "auth/org-members/delete": {
    // Schema key is a lookup identifier; actual route is /api/auth/org-members.
    path: "auth/org-members",
    req: z
      .object({
        orgId: z.string().min(1),
        targetUserId: z.string().min(1),
      })
      .brand<"AuthOrgMembersDeleteRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
    }),
  },

  /**
   * PATCH /api/auth/organizations
   * Update organization details
   */
  "auth/organizations/update": {
    // Schema key is a lookup identifier; actual route is /api/auth/organizations.
    path: "auth/organizations",
    req: z
      .object({
        org_id: z.string(),
        name: z.string(),
      })
      .brand<"AuthOrganizationsUpdateRequest">(),
    res: z.object({
      ok: z.boolean(),
    }),
  },

  /**
   * PATCH /api/user
   * Update user profile
   */
  "user/update": {
    // Schema key is a lookup identifier; actual route is /api/user.
    path: "user",
    req: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      })
      .brand<"UserUpdateRequest">(),
    res: z.object({
      ok: z.boolean(),
    }),
  },

  /**
   * POST /api/auth/signup
   * Create a new user account
   */
  signup: {
    req: z
      .object({
        email: z.string().email("Invalid email format"),
        password: z
          .string()
          .min(6, "Password must be at least 6 characters")
          .max(64, "Password must be at most 64 characters"),
        name: z.string().max(100).optional(),
        accessCode: z.string().min(1, "Access code is required"),
      })
      .brand<"SignupRequest">(),
    res: z.object({
      ok: z.literal(true),
      userId: z.string(),
      email: z.string(),
      message: z.string(),
    }),
  },

  /**
   * POST /api/deploy
   * Create a new site on the current server wildcard domain
   */
  deploy: {
    req: z
      .object({
        domain: z.string().min(1),
        orgId: z.string().min(1, "Organization ID cannot be empty").optional(),
        siteIdeas: DeploySiteIdeasSchema,
        templateId: DeployTemplateIdSchema.optional(),
      })
      .strict()
      .brand<"DeployRequest">(),
    res: NewSiteSuccessResponseSchema,
  },

  /**
   * POST /api/deploy-subdomain
   * Create a new website deployment
   * Requires authenticated session.
   */
  "deploy-subdomain": {
    req: DeploySubdomainSchema.brand<"DeploySubdomainRequest">(),
    res: NewSiteSuccessResponseSchema,
  },

  /**
   * POST /api/rename-site
   * Rename a site's domain. Superadmin only.
   */
  "rename-site": {
    req: z
      .object({
        oldDomain: z.string().min(1, "Old domain is required"),
        newDomain: z.string().min(1, "New domain is required"),
      })
      .strict()
      .brand<"RenameSiteRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
      oldDomain: z.string(),
      newDomain: z.string(),
    }),
  },

  /**
   * POST /api/import-repo
   * Import a GitHub repository as a new site
   * Requires authenticated session with GitHub integration connected
   */
  "import-repo": {
    req: z
      .object({
        slug: DeploySlugSchema,
        repoUrl: z.string().min(1, "Repository URL is required"),
        branch: z.string().optional(),
        orgId: z.string().min(1, "Organization ID cannot be empty").optional(),
        siteIdeas: DeploySiteIdeasSchema,
      })
      .strict()
      .brand<"ImportRepoRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
      domain: z.string(),
      chatUrl: z.string(),
      orgId: z.string().optional(),
      executionMode: ExecutionModeSchema,
    }),
  },

  // ============================================================================
  // AUTOMATIONS & SITES (used by TanStack Query)
  // ============================================================================

  /**
   * GET /api/automations
   * List automation jobs
   */
  automations: {
    query: z.object({
      org_id: z.string().min(1).optional(),
      site_id: z.string().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    }),
    res: z.object({
      ok: z.literal(true),
      automations: z.array(
        z.object({
          id: z.string(),
          site_id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          trigger_type: TriggerTypeSchema,
          cron_schedule: z.string().nullable(),
          cron_timezone: z.string().nullable(),
          run_at: z.string().nullable(),
          action_type: ActionTypeSchema,
          action_prompt: z.string().nullable(),
          action_source: z.string().nullable(),
          action_target_page: z.string().nullable(),
          action_timeout_seconds: z.number().nullable().optional(),
          action_model: ClaudeModelSchema.nullable().optional(),
          skills: z.array(z.string()).nullable(),
          email_address: z.string().nullable().optional(),
          is_active: z.boolean(),
          status: AutomationJobStatusSchema.optional(),
          last_run_at: z.string().nullable(),
          last_run_status: AutomationRunStatusSchema.nullable(),
          next_run_at: z.string().nullable(),
          created_at: z.string(),
          hostname: z.string().optional(),
        }),
      ),
      total: z.number().optional(),
    }),
  },

  /**
   * GET /api/automations/enriched
   * Enriched automation jobs with run stats (server-to-server proxy to apps/api)
   */
  "automations/enriched": {
    query: z.object({
      workspace: z.string().min(1).optional(),
    }),
    res: z.object({
      ok: z.literal(true),
      jobs: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          hostname: z.string(),
          is_active: z.boolean(),
          status: z.string(),
          trigger_type: TriggerTypeSchema,
          cron_schedule: z.string().nullable(),
          cron_timezone: z.string().nullable(),
          email_address: z.string().nullable(),
          last_run_at: z.string().nullable(),
          last_run_status: AutomationRunStatusSchema.nullable(),
          last_run_error: z.string().nullable(),
          next_run_at: z.string().nullable(),
          consecutive_failures: z.number().nullable(),
          action_prompt: z.string().nullable(),
          action_model: z.string().nullable(),
          action_target_page: z.string().nullable(),
          action_timeout_seconds: z.number().nullable().optional(),
          skills: z.array(z.string()).nullable(),
          avatar_url: z.string().nullable().optional(),
          created_at: z.string(),
          runs_30d: z.number(),
          success_runs_30d: z.number(),
          failure_runs_30d: z.number(),
          avg_duration_ms: z.number().nullable(),
          estimated_weekly_cost_usd: z.number(),
          recent_runs: z.array(
            z.object({
              id: z.string(),
              status: z.string(),
              started_at: z.string(),
              completed_at: z.string().nullable(),
              duration_ms: z.number().nullable(),
              error: z.string().nullable(),
              triggered_by: z.string().nullable(),
              chat_conversation_id: z.string().nullable().optional(),
            }),
          ),
        }),
      ),
    }),
  },

  /**
   * POST /api/automations
   * Create a new automation job
   */
  "automations/create": {
    // Schema key is a lookup identifier; actual route is /api/automations.
    path: "automations",
    req: z
      .object({
        site_id: z.string().min(1),
        name: z.string().min(AGENT_CONSTRAINTS.NAME_MIN).max(AGENT_CONSTRAINTS.NAME_MAX),
        trigger_type: TriggerTypeSchema,
        action_type: ActionTypeSchema,
        description: z.string().nullable().optional(),
        cron_schedule: z.string().nullable().optional(),
        cron_timezone: z.string().nullable().optional(),
        schedule_text: z.string().max(AGENT_CONSTRAINTS.SCHEDULE_TEXT_MAX).nullable().optional(),
        run_at: z.string().nullable().optional(),
        action_prompt: z.string().max(AGENT_CONSTRAINTS.PROMPT_MAX).nullable().optional(),
        action_source: z.string().nullable().optional(),
        action_target_page: z.string().nullable().optional(),
        action_timeout_seconds: z
          .number()
          .min(AGENT_CONSTRAINTS.TIMEOUT_MIN)
          .max(AGENT_CONSTRAINTS.TIMEOUT_MAX)
          .nullable()
          .optional(),
        action_model: ClaudeModelSchema.nullable().optional(),
        skills: z.array(z.string()).optional().default([]),
        email_address: z.string().email().nullable().optional(),
        is_active: z.boolean().optional().default(true),
      })
      .brand<"AutomationsCreateRequest">(),
    res: z.object({
      ok: z.literal(true),
      automation: z.object({
        id: z.string(),
        site_id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        trigger_type: TriggerTypeSchema,
        cron_schedule: z.string().nullable(),
        cron_timezone: z.string().nullable(),
        run_at: z.string().nullable(),
        action_type: ActionTypeSchema,
        action_prompt: z.string().nullable(),
        action_source: z.string().nullable(),
        action_target_page: z.string().nullable(),
        action_timeout_seconds: z.number().nullable().optional(),
        action_model: ClaudeModelSchema.nullable().optional(),
        skills: z.array(z.string()).nullable(),
        is_active: z.boolean(),
        status: AutomationJobStatusSchema.optional(),
        next_run_at: z.string().nullable(),
        created_at: z.string(),
      }),
    }),
  },

  /**
   * GET /api/automations/[id]
   * Get a single automation job by ID
   */
  "automations/get-by-id": {
    params: z.object({ id: z.string().min(1) }),
    res: z.object({
      ok: z.literal(true),
      automation: z.record(z.string(), z.unknown()),
    }),
  },

  /**
   * PATCH /api/automations/[id]
   * Update an existing automation job
   */
  "automations/update": {
    // Dynamic route: /api/automations/[id].
    // Callers must pass pathOverride with the concrete automation ID.
    params: z.object({ id: z.string().min(1) }),
    req: z
      .object({
        name: z.string().min(AGENT_CONSTRAINTS.NAME_MIN).max(AGENT_CONSTRAINTS.NAME_MAX).optional(),
        description: z.string().nullable().optional(),
        cron_schedule: z.string().nullable().optional(),
        cron_timezone: z.string().nullable().optional(),
        schedule_text: z.string().max(AGENT_CONSTRAINTS.SCHEDULE_TEXT_MAX).nullable().optional(),
        run_at: z.string().nullable().optional(),
        action_prompt: z.string().max(AGENT_CONSTRAINTS.PROMPT_MAX).nullable().optional(),
        action_source: z.string().nullable().optional(),
        action_target_page: z.string().nullable().optional(),
        action_model: ClaudeModelSchema.nullable().optional(),
        action_timeout_seconds: z
          .number()
          .min(AGENT_CONSTRAINTS.TIMEOUT_MIN)
          .max(AGENT_CONSTRAINTS.TIMEOUT_MAX)
          .nullable()
          .optional(),
        skills: z.array(z.string()).optional(),
        is_active: z.boolean().optional(),
        avatar_url: z.string().nullable().optional(),
      })
      .brand<"AutomationsUpdateRequest">(),
    res: z.object({
      automation: z.record(z.string(), z.unknown()),
      nextRunsPreview: z.string().optional(),
    }),
  },

  /**
   * GET /api/sites
   * List sites for user's organizations
   */
  sites: {
    query: z.object({
      org_id: z.string().min(1).optional(),
    }),
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

  /**
   * GET /api/worktrees?workspace=<domain>
   * List worktrees for a workspace
   */
  worktrees: {
    query: z.object({
      workspace: z.string().optional(),
    }),
    res: z.object({
      ok: z.literal(true),
      worktrees: z.array(
        z.object({
          slug: z.string(),
          pathRelative: z.string(),
          branch: z.string().nullable(),
          head: z.string().nullable(),
        }),
      ),
    }),
  },

  /**
   * POST /api/worktrees
   * Create a worktree
   */
  "worktrees/create": {
    // Schema key is a lookup identifier; actual route is /api/worktrees.
    path: "worktrees",
    req: z
      .object({
        workspace: z.string(),
        slug: OptionalWorktreeSlugSchema,
        branch: z.string().optional(),
        from: z.string().optional(),
      })
      .brand<"WorktreesCreateRequest">(),
    res: z.object({
      ok: z.literal(true),
      slug: z.string(),
      branch: z.string(),
      worktreePath: z.string(),
    }),
  },

  /**
   * DELETE /api/worktrees?workspace=<domain>&slug=<slug>
   * Remove a worktree
   */
  "worktrees/delete": {
    // Schema key is a lookup identifier; actual route is /api/worktrees.
    // Note: callers still pass query params (workspace/slug) via pathOverride.
    path: "worktrees",
    query: z.object({
      workspace: z.string().optional(),
      slug: z.string().optional(),
      deleteBranch: z
        .enum(["true", "false"])
        .optional()
        .transform(v => v === "true"),
    }),
    req: z.undefined().brand<"WorktreesDeleteRequest">(),
    res: z.object({
      ok: z.literal(true),
    }),
  },

  /**
   * DELETE /api/automations/[id]
   * Delete an automation job
   */
  "automations/delete": {
    params: z.object({ id: z.string().min(1) }),
    req: z.undefined().brand<"AutomationsDeleteRequest">(),
    res: z.object({
      ok: z.literal(true),
    }),
  },

  /**
   * POST /api/automations/[id]/trigger
   * Manually trigger an automation to run immediately
   */
  "automations/trigger": {
    // Dynamic route: /api/automations/[id]/trigger.
    // Callers must pass pathOverride with the concrete automation ID.
    params: z.object({ id: z.string().min(1) }),
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

  /**
   * GET /api/automations/[id]/runs
   * List runs for an automation job
   */
  "automations/runs": {
    // Dynamic route: /api/automations/[id]/runs.
    // Callers must pass pathOverride with the concrete automation ID.
    params: z.object({ id: z.string().min(1) }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
      status: AutomationRunStatusSchema.optional(),
    }),
    res: z.object({
      ok: z.literal(true),
      runs: z.array(
        z.object({
          id: z.string(),
          job_id: z.string(),
          started_at: z.string(),
          completed_at: z.string().nullable(),
          duration_ms: z.number().nullable(),
          status: AutomationRunStatusSchema,
          error: z.string().nullable(),
          triggered_by: z.string().nullable(),
          changes_made: z.array(z.string()).nullable(),
          result: z.record(z.string(), z.unknown()).nullable(),
          chat_conversation_id: z.string().nullable(),
          chat_tab_id: z.string().nullable(),
        }),
      ),
      job: z.object({
        id: z.string(),
        name: z.string(),
      }),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
      }),
    }),
  },

  /**
   * GET /api/automations/[id]/runs/[runId]
   * Get details for a single automation run
   */
  "automations/run": {
    params: z.object({ id: z.string().min(1), runId: z.string().min(1) }),
    query: z.object({
      includeMessages: z
        .enum(["true", "false"])
        .optional()
        .default("true")
        .transform(value => value === "true"),
    }),
    res: z.object({
      ok: z.literal(true),
      run: z.object({
        id: z.string(),
        job_id: z.string(),
        started_at: z.string(),
        completed_at: z.string().nullable(),
        duration_ms: z.number().nullable(),
        status: AutomationRunStatusSchema,
        error: z.string().nullable(),
        result: z.record(z.string(), z.unknown()).nullable(),
        triggered_by: z.string().nullable(),
        changes_made: z.array(z.string()).nullable(),
        messages: z.array(z.unknown()),
      }),
    }),
  },

  // ============================================================================
  // USER ENVIRONMENT KEYS (lockbox-backed)
  // ============================================================================

  /**
   * GET /api/user-env-keys
   * List env key names grouped by (name, workspace). Values are NOT returned.
   */
  "user-env-keys": {
    res: z.object({
      ok: z.literal(true),
      keys: z.array(
        z.object({
          name: z.string(),
          hasValue: z.literal(true),
          /** "" = all workspaces (global), non-empty = workspace-scoped */
          workspace: z.string(),
          /** Environments this key is available in. Empty array = all environments. */
          environments: z.array(z.string()),
        }),
      ),
    }),
  },

  /**
   * POST /api/user-env-keys
   * Create or update an env key. Creates one DB row per environment.
   */
  "user-env-keys/create": {
    path: "user-env-keys",
    req: z
      .object({
        keyName: z
          .string()
          .min(1, "Key name is required")
          .max(100, "Key name too long")
          .regex(
            /^[A-Z][A-Z0-9_]*$/,
            "Key name must be uppercase, start with a letter, and contain only letters, numbers, and underscores",
          )
          .refine(name => !(RESERVED_USER_ENV_KEYS as readonly string[]).includes(name), {
            message: "This is a reserved key name and cannot be set by users",
          }),
        keyValue: z.string().min(1, "Key value is required").max(10000, "Key value too long"),
        /** "" = all workspaces, non-empty = workspace-scoped */
        workspace: z.string().optional().default(""),
        /** Environments to make this key available in. Empty array = all environments (global). */
        environments: z.array(z.string()).optional().default([]),
      })
      .brand<"UserEnvKeysCreateRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
      keyName: z.string(),
    }),
  },

  /**
   * PUT /api/user-env-keys
   * Update which environments a key is available in (server-side re-encryption).
   */
  "user-env-keys/update": {
    path: "user-env-keys",
    req: z
      .object({
        keyName: z.string().min(1, "Key name is required"),
        workspace: z.string().optional().default(""),
        /** New set of environments. Empty array = all environments (global). */
        environments: z.array(z.string()),
      })
      .brand<"UserEnvKeysUpdateRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
      keyName: z.string(),
    }),
  },

  /**
   * DELETE /api/user-env-keys
   * Remove an env key (all environment rows for the given name + workspace)
   */
  "user-env-keys/delete": {
    path: "user-env-keys",
    req: z
      .object({
        keyName: z.string().min(1, "Key name is required"),
        workspace: z.string().optional().default(""),
      })
      .brand<"UserEnvKeysDeleteRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
      keyName: z.string(),
    }),
  },

  // ============================================================================
  // INTEGRATIONS (used by TanStack Query)
  // ============================================================================

  /**
   * GET /api/integrations/available
   * Get available integrations for the current user
   */
  "integrations/available": {
    res: z.object({
      integrations: z.array(
        z.object({
          provider_key: z.string(),
          display_name: z.string(),
          logo_path: z.string().nullable(),
          is_connected: z.boolean(),
          visibility_status: z.string(),
          token_status: z.enum(["valid", "expired", "needs_reauth", "not_connected"]).optional(),
          status_message: z.string().optional(),
        }),
      ),
      user_id: z.string().optional(),
    }),
  },

  /**
   * DELETE /api/integrations/[provider]
   * Disconnect user from a provider
   * Uses pathOverride for dynamic provider path
   */
  "integrations/disconnect": {
    // Dynamic route: /api/integrations/[provider].
    // Callers must pass pathOverride with the concrete provider key.
    params: z.object({ provider: z.string().min(1) }),
    req: z.undefined().brand<"IntegrationsDisconnectRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
    }),
  },

  /**
   * POST /api/integrations/[provider]
   * Connect user to a provider using a Personal Access Token (PAT)
   * Uses pathOverride for dynamic provider path
   */
  "integrations/connect": {
    // Dynamic route: /api/integrations/[provider].
    // Callers must pass pathOverride with the concrete provider key.
    params: z.object({ provider: z.string().min(1) }),
    req: z
      .object({
        token: z.string().min(1),
      })
      .brand<"IntegrationsConnectRequest">(),
    res: z.object({
      ok: z.literal(true),
      message: z.string(),
      username: z.string().optional(),
    }),
  },
  // ============================================================================
  // EMAIL (Gmail + Outlook)
  // ============================================================================

  /**
   * POST /api/gmail/send
   * Send an email via Gmail API
   */
  "gmail/send": {
    req: z
      .object({
        to: z.array(z.string()).min(1),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        threadId: z.string().optional(),
      })
      .brand<"GmailSendRequest">(),
    res: z.object({
      ok: z.literal(true),
      messageId: z.string(),
      threadId: z.string().optional(),
    }),
  },

  /**
   * POST /api/gmail/draft
   * Save a draft via Gmail API
   */
  "gmail/draft": {
    req: z
      .object({
        to: z.array(z.string()).min(1),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        threadId: z.string().optional(),
      })
      .brand<"GmailDraftRequest">(),
    res: z.object({
      ok: z.literal(true),
      draftId: z.string(),
      messageId: z.string().optional(),
    }),
  },

  /**
   * POST /api/outlook/send
   * Send an email via Microsoft Graph
   */
  "outlook/send": {
    req: z
      .object({
        to: z.array(z.string()).min(1),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        threadId: z.string().optional(),
      })
      .brand<"OutlookSendRequest">(),
    res: z.object({
      ok: z.literal(true),
      messageId: z.string(),
      threadId: z.string().optional(),
    }),
  },

  /**
   * POST /api/outlook/draft
   * Save a draft via Microsoft Graph
   */
  "outlook/draft": {
    req: z
      .object({
        to: z.array(z.string()).min(1),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        threadId: z.string().optional(),
      })
      .brand<"OutlookDraftRequest">(),
    res: z.object({
      ok: z.literal(true),
      draftId: z.string(),
      messageId: z.string().optional(),
    }),
  },

  // ============================================================================
  // DRIVE (file storage panel)
  // ============================================================================

  /**
   * POST /api/drive/list
   * List files in the drive directory
   */
  "drive/list": {
    req: z
      .object({
        workspace: z.string().min(1),
        path: z.string().default(""),
        worktree: OptionalWorktreeSlugSchema, // Validated to prevent session key corruption
      })
      .brand<"DriveListRequest">(),
    res: z.object({
      ok: z.literal(true),
      path: z.string(),
      files: z.array(
        z.object({
          name: z.string(),
          type: z.enum(["file", "directory"]),
          size: z.number(),
          modified: z.string(),
          path: z.string(),
        }),
      ),
    }),
  },

  /**
   * POST /api/drive/read
   * Read a file from the drive directory
   */
  "drive/read": {
    req: z
      .object({
        workspace: z.string().min(1),
        path: z.string().min(1),
        worktree: OptionalWorktreeSlugSchema, // Validated to prevent session key corruption
      })
      .brand<"DriveReadRequest">(),
    res: z.object({
      ok: z.literal(true),
      path: z.string(),
      filename: z.string(),
      content: z.string(),
      language: z.string(),
      size: z.number(),
    }),
  },

  /**
   * POST /api/sessions
   * Send a message to another session (A2A communication)
   */
  "sessions/send": {
    // Schema key is a lookup identifier; actual route is /api/sessions.
    path: "sessions",
    req: z
      .object({
        targetSessionKey: z.string().min(1),
        message: z.string().min(1),
        timeoutSeconds: z.number().positive().max(300).optional().default(30),
        waitForReply: z.boolean().optional().default(true),
      })
      .brand<"SessionsSendRequest">(),
    res: z.object({
      status: z.string(),
      runId: z.string().optional(),
      sessionKey: z.string().optional(),
      message: z.string().optional(),
    }),
  },

  // ============================================================================
  // GOOGLE CALENDAR
  // ============================================================================

  /**
   * POST /api/google/calendar/create-event
   * Create a Google Calendar event (user-confirmed action)
   */
  "google/calendar/create-event": {
    req: z
      .object({
        summary: z.string().min(1, "Event title is required"),
        description: z.string().optional(),
        start: z.object({
          dateTime: z.string().datetime("Start must be ISO 8601 datetime"),
          timeZone: z.string().optional(),
        }),
        end: z.object({
          dateTime: z.string().datetime("End must be ISO 8601 datetime"),
          timeZone: z.string().optional(),
        }),
        location: z.string().optional(),
        attendees: z
          .array(
            z.object({
              email: z.string().email("Invalid attendee email"),
              optional: z.boolean().optional(),
            }),
          )
          .optional(),
        calendarId: z.string().default("primary"),
        transparency: z.enum(["opaque", "transparent"]).optional(),
        recurrence: z.array(z.string()).optional(),
      })
      .brand<"CalendarCreateEventRequest">(),
    res: z.object({
      ok: z.literal(true),
      eventId: z.string(),
      calendarId: z.string(),
      htmlLink: z.string(),
    }),
  },

  /**
   * DELETE /api/google/calendar/delete-event
   * Delete a Google Calendar event (user-confirmed action)
   */
  "google/calendar/delete-event": {
    req: z
      .object({
        calendarId: z.string().min(1, "Calendar ID required"),
        eventId: z.string().min(1, "Event ID required"),
      })
      .brand<"CalendarDeleteEventRequest">(),
    res: z.object({
      ok: z.literal(true),
      eventId: z.string(),
      calendarId: z.string(),
    }),
  },

  /**
   * PATCH /api/google/calendar/update-event
   * Update an existing Google Calendar event (user-confirmed action)
   */
  "google/calendar/update-event": {
    req: z
      .object({
        calendarId: z.string().min(1, "Calendar ID required"),
        eventId: z.string().min(1, "Event ID required"),
        summary: z.string().min(1, "Event title is required").optional(),
        description: z.string().optional(),
        start: z
          .object({
            dateTime: z.string().datetime("Start must be ISO 8601 datetime"),
            timeZone: z.string().optional(),
          })
          .optional(),
        end: z
          .object({
            dateTime: z.string().datetime("End must be ISO 8601 datetime"),
            timeZone: z.string().optional(),
          })
          .optional(),
        location: z.string().optional(),
        attendees: z
          .array(
            z.object({
              email: z.string().email("Invalid attendee email"),
              optional: z.boolean().optional(),
            }),
          )
          .optional(),
        transparency: z.enum(["opaque", "transparent"]).optional(),
      })
      .brand<"CalendarUpdateEventRequest">(),
    res: z.object({
      ok: z.literal(true),
      eventId: z.string(),
      calendarId: z.string(),
      htmlLink: z.string(),
    }),
  },

  /**
   * POST /api/drive/delete
   * Delete a file or directory in the drive
   */
  "drive/delete": {
    req: z
      .object({
        workspace: z.string().min(1),
        path: z.string().min(1),
        worktree: OptionalWorktreeSlugSchema, // Validated to prevent session key corruption
        recursive: z.boolean().optional(),
      })
      .brand<"DriveDeleteRequest">(),
    res: z.object({
      ok: z.literal(true),
      deleted: z.string(),
      type: z.enum(["file", "directory"]),
    }),
  },

  // ============================================================================
  // AUTH SESSIONS
  // ============================================================================

  /**
   * GET /api/auth/sessions
   * List active login sessions for the current user
   */
  "auth/sessions": {
    res: z.object({
      ok: z.literal(true),
      sessions: z.array(
        z.object({
          sid: z.string(),
          deviceLabel: z.string().nullable(),
          ipAddress: z.string().nullable(),
          createdAt: z.string(),
          lastActiveAt: z.string(),
          isCurrent: z.boolean(),
        }),
      ),
      currentSid: z.string(),
    }),
  },

  /**
   * POST /api/auth/sessions/revoke
   * Revoke a single session by sid
   */
  "auth/sessions/revoke": {
    req: z
      .object({
        sid: z.string().uuid(),
      })
      .brand<"RevokeSessionRequest">(),
    res: z.object({
      ok: z.literal(true),
      revoked: z.boolean(),
    }),
  },

  /**
   * POST /api/auth/sessions/revoke-others
   * Revoke all sessions except the current one
   */
  "auth/sessions/revoke-others": {
    req: z.undefined().brand<"RevokeOtherSessionsRequest">(),
    res: z.object({
      ok: z.literal(true),
      revokedCount: z.number(),
    }),
  },

  // ============================================================================
  // GET QUERY SCHEMAS — validated via handleQuery()
  // ============================================================================

  /**
   * GET /api/sessions?workspace=xxx&activeMinutes=xxx&limit=xxx
   * List sessions (A2A communication)
   */
  "sessions/list": {
    path: "sessions",
    query: z.object({
      workspace: z.string().optional(),
      activeMinutes: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
    res: z.object({
      count: z.number(),
      sessions: z.array(z.unknown()),
    }),
  },

  /**
   * GET /api/sessions/history?sessionKey=xxx&limit=xxx&includeTools=xxx&after=xxx
   * Fetch conversation history from a session
   */
  "sessions/history": {
    query: z.object({
      sessionKey: z
        .string()
        .regex(
          /^[^:]+::[^:]+(?:::wt\/[^:]+)?::[^:]+::[^:]+$/,
          "Invalid session key format (expected userId::workspace[::wt/slug]::tabGroupId::tabId)",
        ),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      includeTools: z
        .enum(["true", "false"])
        .optional()
        .default("false")
        .transform(value => value === "true"),
      after: z.string().optional(),
    }),
    res: z.object({
      sessionKey: z.string(),
      messages: z.array(z.unknown()),
      count: z.number(),
    }),
  },

  /**
   * GET /api/linear/issues?limit=xxx&includeCompleted=xxx
   * Fetch Linear issues assigned to current user
   */
  "linear/issues": {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(50).default(25),
      includeCompleted: z
        .enum(["true", "false"])
        .optional()
        .default("false")
        .transform(value => value === "true"),
    }),
    res: z.object({
      ok: z.literal(true),
      issues: z.array(z.unknown()),
      totalCount: z.number(),
    }),
  },

  /**
   * GET /api/sites/check-availability?slug=xxx
   * Check if a slug is available for deployment
   */
  "sites/check-availability": {
    query: z.object({
      slug: z
        .string()
        .min(1)
        .transform(s => s.toLowerCase()),
    }),
    res: z.object({
      available: z.boolean(),
      slug: z.string().optional(),
      reason: z.string().optional(),
    }),
  },

  /**
   * GET /api/sites/metadata?slug=xxx
   * Fetch metadata for a site by slug
   */
  "sites/metadata": {
    query: z.object({
      slug: z.string().min(1),
    }),
    res: z.object({
      ok: z.literal(true),
      metadata: z.unknown(),
    }),
  },

  /**
   * GET /api/referrals/history?limit=xxx&offset=xxx
   * Fetch referral history with pagination
   */
  "referrals/history": {
    query: z.object({
      limit: z.coerce
        .number()
        .int()
        .default(50)
        .transform(n => Math.min(Math.max(n, 1), 100)),
      offset: z.coerce
        .number()
        .int()
        .default(0)
        .transform(n => Math.max(n, 0)),
    }),
    res: z.object({
      ok: z.literal(true),
      data: z.object({
        referrals: z.array(z.unknown()),
        total: z.number(),
        hasMore: z.boolean(),
      }),
    }),
  },

  /**
   * GET /api/conversations?workspace=xxx&limit=50&cursor=xxx
   * Fetch user's conversations. workspace is optional — omit for cross-workspace fetch.
   */
  "conversations/list": {
    path: "conversations",
    query: z.object({
      workspace: z.string().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      cursor: z.string().optional(),
    }),
    res: z.object({
      own: z.array(z.unknown()),
      shared: z.array(z.unknown()),
      hasMore: z.boolean().optional(),
      nextCursor: z.string().nullable().optional(),
    }),
  },

  /**
   * GET /api/conversations/messages?tabId=xxx&cursor=xxx&limit=xxx
   * Fetch messages for a tab (lazy loading)
   */
  "conversations/messages": {
    query: z.object({
      tabId: z.string().min(1),
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }),
    res: z.object({
      messages: z.array(z.unknown()),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
    }),
  },

  /**
   * GET /api/images/list?workspace=xxx&worktree=xxx
   * List images for a workspace
   */
  "images/list": {
    query: z.object({
      workspace: z.string().optional(),
      worktree: z.string().optional(),
    }),
    res: z.object({
      ok: z.literal(true),
      images: z.array(z.unknown()),
      count: z.number(),
    }),
  },

  /**
   * POST /api/voice/transcribe (multipart/form-data)
   * Transcribe audio via Groq Whisper. Request is FormData (not JSON).
   * Only the response is schema-validated via alrighty.
   */
  "voice/transcribe": {
    res: z.object({
      ok: z.literal(true),
      text: z.string().min(1),
      duration: z.number().nullable(),
      language: z.string().nullable(),
    }),
  },

  // ---------------------------------------------------------------------------
  // Polar billing (proxied to apps/api via Next.js rewrite)
  // ---------------------------------------------------------------------------

  "polar/billing": {
    res: z.object({
      subscription: z
        .object({
          id: z.string(),
          status: z.string(),
          productId: z.string(),
          currentPeriodEnd: z.string().nullable(),
        })
        .nullable(),
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          isRecurring: z.boolean(),
          prices: z.array(
            z.object({
              id: z.string(),
              amountType: z.string(),
              priceAmount: z.number().nullable(),
              priceCurrency: z.string().nullable(),
            }),
          ),
        }),
      ),
      portalUrl: z.string().nullable(),
    }),
  },

  "polar/checkout": {
    req: z
      .object({
        productId: z.string().min(1),
      })
      .brand<"PolarCheckoutRequest">(),
    res: z.object({
      url: z.string().url(),
    }),
  },
} as const

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Endpoint = keyof typeof apiSchemas
export type Req<E extends Endpoint> = PkgReq<typeof apiSchemas, E>
/** Raw input accepted by the endpoint request schema before parsing/branding */
export type ReqInput<E extends Endpoint> = PkgReqInput<typeof apiSchemas, E>
export type Res<E extends Endpoint> = PkgRes<typeof apiSchemas, E>
/** What callers pass to alrighty — `ok` is auto-injected */
export type ResPayload<E extends Endpoint> = PkgResPayload<typeof apiSchemas, E>
/** Validated URL path params for an endpoint (e.g., `{ id: string }`) */
export type Params<E extends Endpoint> = PkgParams<typeof apiSchemas, E>
/** Validated URL query params for an endpoint (e.g., `{ limit: number }`) */
export type Query<E extends Endpoint> = PkgQuery<typeof apiSchemas, E>

/** Endpoints that define a request schema (including `z.undefined()` request schemas). */
type EndpointWithReq = {
  [K in Endpoint]: "req" extends keyof (typeof apiSchemas)[K] ? K : never
}[Endpoint]

/** Endpoints with explicit `z.undefined()` request schemas. */
type UndefinedReqEndpoint = {
  [K in EndpointWithReq]: [ReqInput<K>] extends [undefined] ? K : never
}[EndpointWithReq]

/** Endpoints whose request schema expects a non-undefined body. */
type NonUndefinedReqEndpoint = Exclude<EndpointWithReq, UndefinedReqEndpoint>

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
 *
 * // ✅ For no-body endpoints with req: z.undefined(), omit body or pass undefined
 * const triggerReq = validateRequest("automations/trigger")
 * ```
 *
 * @throws {ZodError} If validation fails (invalid email, password too short, etc.)
 */
export function validateRequest<E extends UndefinedReqEndpoint>(endpoint: E, data?: undefined): Req<E>
export function validateRequest<E extends NonUndefinedReqEndpoint>(endpoint: E, data: ReqInput<E>): Req<E>
export function validateRequest<E extends EndpointWithReq>(endpoint: E, data?: unknown): Req<E> {
  const entry: EndpointSchema = apiSchemas[endpoint]
  if (!entry.req) throw new Error(`No request schema defined for ${String(endpoint)}`)
  try {
    return entry.req.parse(data) as Req<E>
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join(", ")
      throw new Error(`validateRequest("${String(endpoint)}"): ${issues}`)
    }
    throw error
  }
}
