import { describe, expect, it } from "vitest"
import { SANDBOX_WORKSPACE_ROOT } from "./manager.js"
import { RuntimePathValidationError, resolveSandboxWorkspacePath } from "./runtime-facade.js"

describe("resolveSandboxWorkspacePath", () => {
  it("allows the workspace root for directory listings", () => {
    expect(resolveSandboxWorkspacePath("", { allowWorkspaceRoot: true })).toBe(SANDBOX_WORKSPACE_ROOT)
  })

  it("rejects the workspace root when a file path is required", () => {
    expect(() => resolveSandboxWorkspacePath("", { allowWorkspaceRoot: false })).toThrow(RuntimePathValidationError)
  })

  it("rejects path traversal attempts", () => {
    expect(() => resolveSandboxWorkspacePath("../secrets.txt", { allowWorkspaceRoot: false })).toThrow(
      RuntimePathValidationError,
    )
  })

  it("resolves nested files inside the sandbox workspace", () => {
    expect(resolveSandboxWorkspacePath("src/app.ts", { allowWorkspaceRoot: false })).toBe(
      `${SANDBOX_WORKSPACE_ROOT}/src/app.ts`,
    )
  })
})
