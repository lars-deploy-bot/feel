import { describe, expect, it, vi } from "vitest"

vi.mock("@webalive/shared", () => ({
  PATHS: {
    SITES_ROOT: "/configured/sites",
  },
}))

import { workspaceToTenantId } from "@/lib/tenant-utils"

describe("workspaceToTenantId", () => {
  it("derives the tenant from the configured sites root", () => {
    expect(workspaceToTenantId("/configured/sites/demo.alive.best/user/src")).toBe("demo.alive.best")
    expect(workspaceToTenantId("/configured/sites/demo.alive.best/")).toBe("demo.alive.best")
  })

  it("fails fast when the workspace path is outside the configured sites root", () => {
    expect(() => workspaceToTenantId("/other-root/demo.alive.best/user")).toThrow(
      "Failed to derive tenant ID from workspace path outside configured sites root",
    )
  })
})
