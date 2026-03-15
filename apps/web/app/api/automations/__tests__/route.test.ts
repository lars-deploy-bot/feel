/**
 * Automations Create Route Tests
 *
 * Covers alive workspace authorization paths for POST /api/automations.
 * Verifies superadmin gate, normal user rejection, and standard site creation.
 */

import { SUPERADMIN } from "@webalive/shared"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionUser } from "@/features/auth/lib/auth"
import { MOCK_SESSION_USER } from "@/lib/test-helpers/mock-session-user"

// =============================================================================
// Mocks
// =============================================================================

const mockUser: SessionUser = { ...MOCK_SESSION_USER, id: "u1", email: "user@example.com", name: "User" }

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock("@/features/auth/lib/protectedRoute", () => ({
  protectedRoute: (handler: (ctx: { user: SessionUser; req: NextRequest; requestId: string }) => Promise<Response>) => {
    return (req: NextRequest) => handler({ user: mockUser, req, requestId: "req-automations-test" })
  },
}))

vi.mock("@/lib/api/server", () => ({
  alrighty: vi.fn((_route: string, payload: Record<string, unknown>, opts?: { status?: number }) => {
    return new Response(JSON.stringify({ ok: true, ...payload }), {
      status: opts?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    })
  }),
  handleBody: vi.fn(async (_endpoint: string, req: NextRequest) => {
    // Parse actual JSON body from request
    const body = await req.json()
    return body
  }),
  isHandleBodyError: vi.fn(() => false),
}))

vi.mock("@/lib/api/responses", () => ({
  structuredErrorResponse: vi.fn((code: string, opts?: { status?: number; details?: Record<string, unknown> }) => {
    return new Response(JSON.stringify({ ok: false, error: code, details: opts?.details }), {
      status: opts?.status ?? 500,
      headers: { "Content-Type": "application/json" },
    })
  }),
}))

vi.mock("@/lib/error-codes", () => ({
  ErrorCodes: {
    INVALID_REQUEST: "INVALID_REQUEST",
    SITE_NOT_FOUND: "SITE_NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    QUERY_FAILED: "QUERY_FAILED",
  },
}))

// Track what was inserted
let insertedRow: Record<string, unknown> | null = null

const mockServiceAppClient = vi.fn(() => ({
  from: (table: string) => {
    if (table === "automation_jobs") {
      return {
        insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const row = Array.isArray(rows) ? rows[0] : rows
          insertedRow = row ?? null
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: row ? { id: "job-new", ...row } : null,
                  error: null,
                }),
            }),
          }
        },
      }
    }
    throw new Error(`Unexpected service table: ${table}`)
  },
}))

vi.mock("@/lib/supabase/server-rls", () => ({
  createRLSAppClient: vi.fn(() => Promise.resolve({})),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceAppClient: () => mockServiceAppClient(),
}))

// Validation mocks — default to valid
const mockValidateActionPrompt = vi.fn((): { valid: boolean; error?: string } => ({ valid: true }))
const mockValidateCronSchedule = vi.fn((): { valid: boolean; error?: string; nextRuns?: Date[] } => ({
  valid: true,
  nextRuns: [],
}))
const mockValidateTimezone = vi.fn((): { valid: boolean; error?: string } => ({ valid: true }))
const mockValidateSiteId = vi.fn(
  (): Promise<{ valid: boolean; error?: string; hostname?: string }> =>
    Promise.resolve({ valid: true, hostname: "test.test.example" }),
)

vi.mock("@/lib/automation/validation", () => ({
  validateActionPrompt: () => mockValidateActionPrompt(),
  validateCronSchedule: () => mockValidateCronSchedule(),
  validateTimezone: () => mockValidateTimezone(),
  validateSiteId: () => mockValidateSiteId(),
}))

vi.mock("@/lib/automation/cron-service", () => ({
  pokeCronService: vi.fn(),
}))

const { POST } = await import("../route")

// =============================================================================
// Helpers
// =============================================================================

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/automations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const baseBody = {
  site_id: "dom_normal_site",
  name: "Test Automation",
  trigger_type: "cron",
  cron_schedule: "0 9 * * *",
  cron_timezone: "Europe/Amsterdam",
  action_type: "prompt",
  action_prompt: "Do something useful",
  skills: [],
  is_active: true,
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/automations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedRow = null

    // Reset user to non-superadmin
    mockUser.id = "u1"
    mockUser.email = "user@example.com"
    mockUser.name = "User"
    mockUser.canSelectAnyModel = false
    mockUser.isAdmin = false
    mockUser.isSuperadmin = false
    mockUser.enabledModels = []

    // Reset validation mocks to defaults
    mockValidateActionPrompt.mockReturnValue({ valid: true })
    mockValidateCronSchedule.mockReturnValue({ valid: true, nextRuns: [] })
    mockValidateTimezone.mockReturnValue({ valid: true })
    mockValidateSiteId.mockResolvedValue({ valid: true, hostname: "test.test.example" })
  })

  it("creates automation for normal site as regular user", async () => {
    const res = await POST(createRequest(baseBody))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(data.automation).toBeDefined()
    expect(insertedRow).toMatchObject({
      site_id: "dom_normal_site",
      user_id: "u1",
      name: "Test Automation",
    })
    // org_id should NOT be in the insert — it's derived from the domain
    expect(insertedRow).not.toHaveProperty("org_id")
  })

  it("returns 403 when non-superadmin creates alive workspace automation", async () => {
    mockValidateSiteId.mockResolvedValue({ valid: true, hostname: SUPERADMIN.WORKSPACE_NAME })

    const res = await POST(
      createRequest({
        ...baseBody,
        site_id: "dom_alive",
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe("FORBIDDEN")
    expect(data.details.message).toContain("superadmin")
    expect(insertedRow).toBeNull()
  })

  it("allows superadmin to create alive workspace automation", async () => {
    mockUser.isSuperadmin = true
    mockValidateSiteId.mockResolvedValue({ valid: true, hostname: SUPERADMIN.WORKSPACE_NAME })

    const res = await POST(
      createRequest({
        ...baseBody,
        site_id: "dom_alive",
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(insertedRow).toMatchObject({
      site_id: "dom_alive",
      user_id: "u1",
    })
  })

  it("returns 404 when site_id validation fails", async () => {
    mockValidateSiteId.mockResolvedValue({ valid: false, error: "Site not found" })

    const res = await POST(createRequest(baseBody))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe("SITE_NOT_FOUND")
    expect(insertedRow).toBeNull()
  })

  it("returns 400 when action_prompt validation fails for prompt type", async () => {
    mockValidateActionPrompt.mockReturnValue({ valid: false, error: "Prompt cannot be empty" })

    const res = await POST(
      createRequest({
        ...baseBody,
        action_prompt: "",
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("INVALID_REQUEST")
    expect(insertedRow).toBeNull()
  })
})
