import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

describe("worker Docker module resolution", () => {
  const tempRoots: string[] = []

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("needs a packages-level node_modules symlink for sibling workspace packages", () => {
    const root = join(tmpdir(), `worker-module-resolution-${Date.now()}`)
    tempRoots.push(root)

    mkdirSync(join(root, "app/worker-deps/node_modules/dep"), { recursive: true })
    mkdirSync(join(root, "app/packages/worker-pool/src"), { recursive: true })
    mkdirSync(join(root, "app/packages/sandbox/dist"), { recursive: true })

    writeFileSync(
      join(root, "app/worker-deps/node_modules/dep/package.json"),
      JSON.stringify({
        name: "dep",
        type: "module",
        exports: "./index.js",
      }),
    )
    writeFileSync(join(root, "app/worker-deps/node_modules/dep/index.js"), "export default 1\n")

    symlinkSync(join(root, "app/worker-deps/node_modules"), join(root, "app/packages/worker-pool/node_modules"))

    const requireFromWorker = createRequire(join(root, "app/packages/worker-pool/src/worker-entry.mjs"))
    const requireFromSandbox = createRequire(join(root, "app/packages/sandbox/dist/index.js"))

    expect(requireFromWorker.resolve("dep")).toContain("/app/worker-deps/node_modules/dep/index.js")
    expect(() => requireFromSandbox.resolve("dep")).toThrowError()

    symlinkSync(join(root, "app/worker-deps/node_modules"), join(root, "app/packages/node_modules"))

    expect(requireFromSandbox.resolve("dep")).toContain("/app/worker-deps/node_modules/dep/index.js")
  })

  it("uses explicit .js extension for generated deploy imports", async () => {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url))
    const source = await readFile(join(repoRoot, "packages/database/src/deploy-contract.ts"), "utf8")

    // deploy-contract.ts must import from deploy.generated.js with explicit .js extension
    // Both the type import and runtime import must use .js
    expect(source).not.toContain('from "./deploy.generated.ts"')
    expect(source).toMatch(/import type\s+\{[^}]+\}\s+from "\.\/deploy\.generated\.js"/)
    expect(source).toMatch(/import\s+\{[^}]+\}\s+from "\.\/deploy\.generated\.js"/)
  })
})
