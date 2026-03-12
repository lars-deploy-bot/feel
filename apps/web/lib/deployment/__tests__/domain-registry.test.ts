import { beforeEach, describe, expect, it, vi } from "vitest"

const domainInsert = vi.fn()
const domainExistsSingle = vi.fn()
const userSingle = vi.fn()
const orgSingle = vi.fn()
const getUserDefaultOrgIdMock = vi.fn()

interface SupabaseClientOptions {
  db?: {
    schema?: string
  }
}

function createAppClientMock() {
  return {
    from(table: string) {
      if (table !== "domains") {
        throw new Error(`Unexpected app table: ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return {
                single: domainExistsSingle,
              }
            },
          }
        },
        insert: domainInsert,
      }
    },
  }
}

function createIamClientMock() {
  return {
    from(table: string) {
      if (table === "users") {
        return {
          select() {
            return {
              eq() {
                return {
                  single: userSingle,
                }
              },
            }
          },
        }
      }

      if (table === "orgs") {
        return {
          select() {
            return {
              eq() {
                return {
                  single: orgSingle,
                }
              },
            }
          },
        }
      }

      throw new Error(`Unexpected iam table: ${table}`)
    },
  }
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((_url: string, _key: string, options?: SupabaseClientOptions) => {
    if (options?.db?.schema === "iam") {
      return createIamClientMock()
    }

    if (options?.db?.schema === "app") {
      return createAppClientMock()
    }

    throw new Error(`Unexpected schema: ${options?.db?.schema ?? "missing"}`)
  }),
}))

vi.mock("@webalive/shared", () => ({
  assertValidServerId: vi.fn(),
  getServerId: vi.fn(() => "srv-test"),
}))

vi.mock("@/lib/deployment/org-resolver", () => ({
  getUserDefaultOrgId: (...args: unknown[]) => getUserDefaultOrgIdMock(...args),
}))

vi.mock("@/types/guards/api", () => ({
  verifyPassword: vi.fn(),
}))

const { registerDomain } = await import("../domain-registry")

describe("registerDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")

    domainExistsSingle.mockResolvedValue({ data: null, error: { code: "PGRST116", message: "not found" } })
    domainInsert.mockResolvedValue({ error: null })
    userSingle.mockResolvedValue({
      data: {
        user_id: "user-123",
        password_hash: null,
      },
      error: null,
    })
    orgSingle.mockResolvedValue({
      data: {
        org_id: "org-test",
        is_test_env: true,
        test_run_id: "run-123",
      },
      error: null,
    })
    getUserDefaultOrgIdMock.mockResolvedValue("org-test")
  })

  it("inherits test flags from a provided organization when registering a domain", async () => {
    await registerDomain({
      hostname: "testsite.alive.best",
      email: "owner@example.com",
      port: 3701,
      executionMode: "e2b",
      orgId: "org-test",
    })

    expect(domainInsert).toHaveBeenCalledWith({
      hostname: "testsite.alive.best",
      port: 3701,
      org_id: "org-test",
      execution_mode: "e2b",
      server_id: "srv-test",
      is_test_env: true,
      test_run_id: "run-123",
    })
  })

  it("inherits test flags from the resolved default organization", async () => {
    await registerDomain({
      hostname: "worker.alive.best",
      email: "owner@example.com",
      port: 3702,
      executionMode: "e2b",
    })

    expect(getUserDefaultOrgIdMock).toHaveBeenCalledWith("user-123", "owner@example.com")
    expect(domainInsert).toHaveBeenCalledWith({
      hostname: "worker.alive.best",
      port: 3702,
      org_id: "org-test",
      execution_mode: "e2b",
      server_id: "srv-test",
      is_test_env: true,
      test_run_id: "run-123",
    })
  })
})
