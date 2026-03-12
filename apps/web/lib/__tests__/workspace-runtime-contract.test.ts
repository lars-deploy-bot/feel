import { describe, expect, it } from "vitest"
import { getWorkspaceRuntimeContractViolation } from "@/lib/workspace-runtime-contract"

describe("getWorkspaceRuntimeContractViolation", () => {
  it("allows local mode without root", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/srv/webalive/sites",
        sitesRootExists: true,
        streamEnv: "local",
        uid: 1000,
      }),
    ).toBeNull()
  })

  it("allows runtimes without a mounted sites root", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/srv/webalive/sites",
        sitesRootExists: false,
        streamEnv: "production",
        uid: 1000,
      }),
    ).toBeNull()
  })

  it("fails fast when a mounted sites root is present under a non-root uid", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/srv/webalive/sites",
        sitesRootExists: true,
        streamEnv: "production",
        uid: 1000,
      }),
    ).toContain("uid=1000")
  })

  it("allows mounted systemd workspaces for root", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/srv/webalive/sites",
        sitesRootExists: true,
        streamEnv: "production",
        uid: 0,
      }),
    ).toBeNull()
  })
})
