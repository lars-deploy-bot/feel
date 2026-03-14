import { describe, expect, it } from "vitest"
import { getMountReadOnlyState, getWorkspaceRuntimeContractViolation } from "@/lib/workspace-runtime-contract"

describe("getWorkspaceRuntimeContractViolation", () => {
  it("allows local mode without root", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/configured/sites",
        sitesRootExists: true,
        sitesRootReadOnly: null,
        streamEnv: "local",
        uid: 1000,
      }),
    ).toBeNull()
  })

  it("allows runtimes without a mounted sites root", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/configured/sites",
        sitesRootExists: false,
        sitesRootReadOnly: null,
        streamEnv: "production",
        uid: 1000,
      }),
    ).toBeNull()
  })

  it("fails fast when a mounted sites root is present under a non-root uid", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/configured/sites",
        sitesRootExists: true,
        sitesRootReadOnly: false,
        streamEnv: "production",
        uid: 1000,
      }),
    ).toContain("uid=1000")
  })

  it("allows mounted systemd workspaces for root", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/configured/sites",
        sitesRootExists: true,
        sitesRootReadOnly: false,
        streamEnv: "production",
        uid: 0,
      }),
    ).toBeNull()
  })

  it("fails fast when the mounted sites root is read-only", () => {
    expect(
      getWorkspaceRuntimeContractViolation({
        sitesRoot: "/configured/sites",
        sitesRootExists: true,
        sitesRootReadOnly: true,
        streamEnv: "production",
        uid: 0,
      }),
    ).toContain("mounted read-only")
  })
})

describe("getMountReadOnlyState", () => {
  it("prefers the most specific matching mount point", () => {
    const mountInfo = [
      "35 20 0:31 / /srv rw,relatime - ext4 /dev/root rw",
      "42 35 0:32 / /configured/sites ro,relatime - ext4 /dev/root ro",
      "43 42 0:33 / /configured/sites/nested rw,relatime - ext4 /dev/root rw",
    ].join("\n")

    expect(getMountReadOnlyState(mountInfo, "/configured/sites/example")).toBe(true)
    expect(getMountReadOnlyState(mountInfo, "/configured/sites/nested/example")).toBe(false)
  })

  it("returns null when no matching mount entry exists", () => {
    expect(getMountReadOnlyState("35 20 0:31 / /tmp rw,relatime - ext4 /dev/root rw", "/configured/sites")).toBeNull()
  })
})
