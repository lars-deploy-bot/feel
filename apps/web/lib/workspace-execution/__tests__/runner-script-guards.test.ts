import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

async function readScript(scriptName: string): Promise<string> {
  const workspaceExecutionDir = fileURLToPath(new URL("..", import.meta.url))
  const webRoot = join(workspaceExecutionDir, "..", "..")
  return readFile(join(webRoot, "scripts", scriptName), "utf8")
}

describe("workspace runner privilege-drop guards", () => {
  it("resets supplementary groups before setgid/setuid in run-agent.mjs", async () => {
    const source = await readScript("run-agent.mjs")

    const setgroupsIndex = source.indexOf("process.setgroups([targetGid])")
    const setgidIndex = source.indexOf("process.setgid(targetGid)")
    const setuidIndex = source.indexOf("process.setuid(targetUid)")

    expect(setgroupsIndex).toBeGreaterThanOrEqual(0)
    expect(setgidIndex).toBeGreaterThanOrEqual(0)
    expect(setuidIndex).toBeGreaterThanOrEqual(0)
    expect(setgroupsIndex).toBeLessThan(setgidIndex)
    expect(setgidIndex).toBeLessThan(setuidIndex)
  })

  it("resets supplementary groups before setgid in run-workspace-command.mjs", async () => {
    const source = await readScript("run-workspace-command.mjs")

    const setgroupsIndex = source.indexOf("process.setgroups([targetGid])")
    const setgidIndex = source.indexOf("process.setgid(targetGid)")

    expect(setgroupsIndex).toBeGreaterThanOrEqual(0)
    expect(setgidIndex).toBeGreaterThanOrEqual(0)
    expect(setgroupsIndex).toBeLessThan(setgidIndex)
  })
})

describe("legacy Claude runner empty-result guard", () => {
  it("fails when the query ends without a terminal result", async () => {
    const source = await readScript("run-agent.mjs")

    expect(source).toContain("Claude query ended without a result after")
    expect(source).toContain(
      "const missingTerminalResultError = getMissingTerminalResultError(queryResult, messageCount)",
    )
    expect(source).toContain("throw new Error(missingTerminalResultError)")
  })
})
