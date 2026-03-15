import { describe, expect, it } from "vitest"
import { authorizeRuntimeAccess, RuntimePermissionError } from "../policy.js"

const baseFacts = {
  userId: "user-1",
  workspace: "example.test.example",
  hasWorkspaceAccess: true,
  isAdmin: false,
  isSuperadmin: false,
  canWriteFiles: false,
  canDeleteFiles: false,
  canEnsureRunning: false,
  canLeaseTerminal: false,
}

describe("authorizeRuntimeAccess", () => {
  it("grants the base runtime scopes for any authorized workspace member", () => {
    const decision = authorizeRuntimeAccess(baseFacts)

    expect(decision.role).toBe("user")
    expect(decision.scopes).toEqual(["runtime:connect", "files:list", "files:read"])
  })

  it("adds elevated scopes when the caller is allowed to perform those operations", () => {
    const decision = authorizeRuntimeAccess({
      ...baseFacts,
      isAdmin: true,
      canWriteFiles: true,
      canDeleteFiles: true,
      canEnsureRunning: true,
      canLeaseTerminal: true,
    })

    expect(decision.role).toBe("admin")
    expect(decision.scopes).toEqual([
      "runtime:connect",
      "files:list",
      "files:read",
      "files:write",
      "files:delete",
      "runtime:ensure-running",
      "terminal:lease",
    ])
  })

  it("rejects callers without workspace access", () => {
    expect(() =>
      authorizeRuntimeAccess({
        ...baseFacts,
        hasWorkspaceAccess: false,
      }),
    ).toThrow(RuntimePermissionError)
  })
})
