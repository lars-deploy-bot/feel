import { describe, expect, it } from "vitest"
import { BootstrapTenantRequestSchema } from "../test-route-schemas"

describe("BootstrapTenantRequestSchema", () => {
  it("accepts non-negative workerIndex and credits", () => {
    const parsed = BootstrapTenantRequestSchema.parse({
      runId: "run_123",
      workerIndex: 0,
      email: "user@example.com",
      workspace: "example.com",
      credits: 10,
    })

    expect(parsed.workerIndex).toBe(0)
    expect(parsed.credits).toBe(10)
  })

  it("rejects negative workerIndex values", () => {
    const parsed = BootstrapTenantRequestSchema.safeParse({
      runId: "run_123",
      workerIndex: -1,
      email: "user@example.com",
      workspace: "example.com",
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects negative credits values", () => {
    const parsed = BootstrapTenantRequestSchema.safeParse({
      runId: "run_123",
      workerIndex: 1,
      email: "user@example.com",
      workspace: "example.com",
      credits: -5,
    })

    expect(parsed.success).toBe(false)
  })
})
