import { beforeEach, describe, expect, it, vi } from "vitest"

const sandboxList = vi.fn()
const sandboxKill = vi.fn()

vi.mock("e2b", () => ({
  Sandbox: {
    list: (...args: unknown[]) => sandboxList(...args),
    kill: (...args: unknown[]) => sandboxKill(...args),
  },
}))

const { collectRunSandboxIds } = await import("../global-teardown")

interface PaginatorItem {
  sandboxId: string
}

function createPaginator(pages: PaginatorItem[][]) {
  let index = 0

  return {
    get hasNext() {
      return index < pages.length
    },
    async nextItems() {
      const nextPage = pages[index]
      index += 1
      return nextPage
    },
  }
}

describe("collectRunSandboxIds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("combines domain-row sandboxes with metadata-recovered sandboxes", async () => {
    sandboxList.mockReturnValueOnce(createPaginator([[{ sandboxId: "sbx_meta" }, { sandboxId: "sbx_domain" }]]))

    const sandboxIds = await collectRunSandboxIds([{ sandbox_id: "sbx_domain" }], "run-123", {
      apiKey: "api-key",
      domain: "e2b.test.local",
    })

    expect(sandboxList).toHaveBeenCalledWith({
      apiKey: "api-key",
      domain: "e2b.test.local",
      limit: 100,
      query: {
        metadata: { test_run_id: "run-123" },
        state: ["running", "paused"],
      },
    })
    expect(sandboxIds).toEqual(["sbx_domain", "sbx_meta"])
  })

  it("still returns metadata sandboxes when domain rows are already gone", async () => {
    sandboxList.mockReturnValueOnce(createPaginator([[{ sandboxId: "sbx_meta" }]]))

    const sandboxIds = await collectRunSandboxIds([], "run-123", {
      apiKey: "api-key",
      domain: "e2b.test.local",
    })

    expect(sandboxIds).toEqual(["sbx_meta"])
  })
})
