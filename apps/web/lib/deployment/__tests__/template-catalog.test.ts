import { beforeEach, describe, expect, it, vi } from "vitest"

const TEST_WILDCARD = "alive.test"

const createAppClientMock = vi.fn()
const existsSyncMock = vi.fn()

type QueryResult<T> = { data: T; error: { message: string; code: string } | null }

interface TemplateRow {
  template_id: string
  name: string
  description: string | null
  ai_description: string | null
  source_path: string
  preview_url: string | null
  image_url: string | null
  is_active: boolean
  deploy_count: number
}

let listResult: QueryResult<TemplateRow[]>
let singleResult: QueryResult<TemplateRow | null>

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
}))

vi.mock("@/lib/supabase/app", () => ({
  createAppClient: (...args: unknown[]) => createAppClientMock(...args),
}))

// Provide a real wildcard domain so getDeploymentTemplatePublicHostname doesn't throw
vi.mock("@webalive/shared", async importOriginal => {
  const actual = await importOriginal<typeof import("@webalive/shared")>()
  return {
    ...actual,
    DOMAINS: { ...actual.DOMAINS, WILDCARD: TEST_WILDCARD },
    PATHS: { ...actual.PATHS, TEMPLATES_ROOT: "/srv/webalive/templates" },
  }
})

const { findDeploymentTemplateById, listDeploymentTemplates } = await import("../template-catalog")

describe("template-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    listResult = {
      data: [
        {
          template_id: "tmpl_blank",
          name: "Blank",
          description: "A blank template",
          ai_description: null,
          source_path: "/srv/webalive/templates/blank.alive.best",
          preview_url: "https://blank.alive.best",
          image_url: null,
          is_active: true,
          deploy_count: 10,
        },
      ],
      error: null,
    }

    singleResult = {
      data: listResult.data[0] ?? null,
      error: null,
    }

    existsSyncMock.mockReturnValue(false)

    createAppClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: (column: string) => {
            if (column === "is_active") {
              return {
                order: () => listResult,
              }
            }

            return {
              maybeSingle: () => singleResult,
            }
          },
        }),
      }),
    })
  })

  it("returns database templates when rows exist", async () => {
    const templates = await listDeploymentTemplates()

    expect(templates).toHaveLength(1)
    expect(templates[0]?.template_id).toBe("tmpl_blank")
    expect(templates[0]?.preview_url).toBe(`https://blank.${TEST_WILDCARD}`)
    expect(existsSyncMock).not.toHaveBeenCalled()
  })

  it("falls back to filesystem templates when the database catalog is empty", async () => {
    listResult = { data: [], error: null }
    existsSyncMock.mockImplementation((input: unknown) => input === "/srv/webalive/templates/blank.alive.best")

    const templates = await listDeploymentTemplates()

    expect(templates).toHaveLength(1)
    expect(templates[0]?.template_id).toBe("tmpl_blank")
    expect(templates[0]?.preview_url).toBe(`https://blank.${TEST_WILDCARD}`)
  })

  it("finds a filesystem template by id when the database row is missing", async () => {
    singleResult = { data: null, error: null }
    existsSyncMock.mockImplementation((input: unknown) => input === "/srv/webalive/templates/blank.alive.best")

    const template = await findDeploymentTemplateById("tmpl_blank")

    expect(template?.template_id).toBe("tmpl_blank")
    expect(template?.source_path).toBe("/srv/webalive/templates/blank.alive.best")
  })
})
