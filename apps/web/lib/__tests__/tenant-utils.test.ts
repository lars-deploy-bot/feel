import { describe, expect, it, vi } from "vitest"

vi.mock("@webalive/shared", () => ({
  PATHS: {
    SITES_ROOT: "/configured/sites",
  },
}))

import { workspaceToTenantId } from "@/lib/tenant-utils"

describe("workspaceToTenantId", () => {
  it("derives the tenant from the configured sites root", () => {
    expect(workspaceToTenantId("/configured/sites/demo.test.example/user/src")).toBe("demo.test.example")
    expect(workspaceToTenantId("/configured/sites/demo.test.example/")).toBe("demo.test.example")
  })

  it("fails fast when the workspace path is outside the configured sites root", () => {
    expect(() => workspaceToTenantId("/other-root/demo.test.example/user")).toThrow(
      "Failed to derive tenant ID from workspace path outside configured sites root",
    )
  })
})
