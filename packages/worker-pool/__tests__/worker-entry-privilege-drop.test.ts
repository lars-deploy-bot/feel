import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

describe("worker-entry privilege drop", () => {
  it("resets supplementary groups before setgid/setuid", async () => {
    const workerPoolDir = fileURLToPath(new URL("..", import.meta.url))
    const source = await readFile(join(workerPoolDir, "src/worker-entry.mjs"), "utf8")

    const setgroupsIndex = source.indexOf("process.setgroups([targetGid])")
    const setgidIndex = source.indexOf("process.setgid(targetGid)")
    const setuidIndex = source.indexOf("process.setuid(targetUid)")

    expect(setgroupsIndex).toBeGreaterThanOrEqual(0)
    expect(setgidIndex).toBeGreaterThanOrEqual(0)
    expect(setuidIndex).toBeGreaterThanOrEqual(0)
    expect(setgroupsIndex).toBeLessThan(setgidIndex)
    expect(setgidIndex).toBeLessThan(setuidIndex)
  })
})
