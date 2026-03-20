import { describe, expect, it, vi } from "vitest"
import { SANDBOX_WORKSPACE_ROOT } from "./manager.js"
import { RuntimePathValidationError } from "./runtime-facade.js"
import { createScopedFilesystem } from "./scoped-files.js"

function mockSandbox() {
  return {
    files: {
      read: vi.fn().mockResolvedValue("file content"),
      write: vi.fn().mockResolvedValue({ path: "/test", size: 10 }),
      list: vi.fn().mockResolvedValue([
        { name: "app.ts", type: "file" },
        { name: "components", type: "dir" },
      ]),
      makeDir: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe("ScopedFilesystem", () => {
  describe("read", () => {
    it("resolves relative path and calls sandbox.files.read", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      const result = await scoped.read("src/app.ts")

      expect(result).toBe("file content")
      expect(sandbox.files.read).toHaveBeenCalledWith(`${SANDBOX_WORKSPACE_ROOT}/src/app.ts`)
    })

    it("throws on path traversal", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.read("../etc/passwd")).rejects.toThrow(RuntimePathValidationError)
      expect(sandbox.files.read).not.toHaveBeenCalled()
    })

    it("throws on workspace root (files require a specific path)", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.read("")).rejects.toThrow(RuntimePathValidationError)
    })

    it("throws on null bytes", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.read("src/\0evil.ts")).rejects.toThrow(RuntimePathValidationError)
    })
  })

  describe("write", () => {
    it("resolves path and calls sandbox.files.write", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await scoped.write("src/app.ts", "new content")

      expect(sandbox.files.write).toHaveBeenCalledWith(`${SANDBOX_WORKSPACE_ROOT}/src/app.ts`, "new content")
    })

    it("throws on traversal", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.write("../../etc/shadow", "evil")).rejects.toThrow(RuntimePathValidationError)
      expect(sandbox.files.write).not.toHaveBeenCalled()
    })
  })

  describe("list", () => {
    it("allows workspace root for directory listings", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      const entries = await scoped.list("")

      expect(sandbox.files.list).toHaveBeenCalledWith(SANDBOX_WORKSPACE_ROOT)
      expect(entries).toEqual([
        { name: "app.ts", kind: "file", path: "app.ts" },
        { name: "components", kind: "directory", path: "components" },
      ])
    })

    it("lists subdirectories with correct relative paths", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await scoped.list("src")

      expect(sandbox.files.list).toHaveBeenCalledWith(`${SANDBOX_WORKSPACE_ROOT}/src`)
    })

    it("throws on traversal", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.list("../")).rejects.toThrow(RuntimePathValidationError)
    })

    it("throws on absolute paths", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.list("/etc")).rejects.toThrow(RuntimePathValidationError)
      expect(sandbox.files.list).not.toHaveBeenCalled()
    })
  })

  describe("makeDir", () => {
    it("resolves path and calls sandbox.files.makeDir", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await scoped.makeDir("src/components")

      expect(sandbox.files.makeDir).toHaveBeenCalledWith(`${SANDBOX_WORKSPACE_ROOT}/src/components`)
    })

    it("swallows 'already exists' errors", async () => {
      const sandbox = mockSandbox()
      sandbox.files.makeDir.mockRejectedValueOnce(new Error("directory already exists"))
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.makeDir("src")).resolves.toBeUndefined()
    })

    it("rethrows non-exists errors", async () => {
      const sandbox = mockSandbox()
      sandbox.files.makeDir.mockRejectedValueOnce(new Error("permission denied"))
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.makeDir("src")).rejects.toThrow("permission denied")
    })
  })

  describe("remove", () => {
    it("resolves path and calls sandbox.files.remove", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await scoped.remove("src/old.ts")

      expect(sandbox.files.remove).toHaveBeenCalledWith(`${SANDBOX_WORKSPACE_ROOT}/src/old.ts`)
    })

    it("blocks workspace root deletion", async () => {
      const sandbox = mockSandbox()
      const scoped = createScopedFilesystem(sandbox as never)

      await expect(scoped.remove("")).rejects.toThrow(RuntimePathValidationError)
      expect(sandbox.files.remove).not.toHaveBeenCalled()
    })
  })

  describe("getEntryKind", () => {
    it("returns 'file' for files", async () => {
      const sandbox = mockSandbox()
      sandbox.files.list.mockResolvedValueOnce([{ name: "app.ts", type: "file" }])
      const scoped = createScopedFilesystem(sandbox as never)

      const kind = await scoped.getEntryKind("src/app.ts")

      expect(kind).toBe("file")
    })

    it("returns 'directory' for dirs", async () => {
      const sandbox = mockSandbox()
      sandbox.files.list.mockResolvedValueOnce([{ name: "components", type: "dir" }])
      const scoped = createScopedFilesystem(sandbox as never)

      const kind = await scoped.getEntryKind("src/components")

      expect(kind).toBe("directory")
    })

    it("returns 'unknown' when entry not found", async () => {
      const sandbox = mockSandbox()
      sandbox.files.list.mockResolvedValueOnce([])
      const scoped = createScopedFilesystem(sandbox as never)

      const kind = await scoped.getEntryKind("src/missing.ts")

      expect(kind).toBe("unknown")
    })

    it("returns 'unknown' when list throws", async () => {
      const sandbox = mockSandbox()
      sandbox.files.list.mockRejectedValueOnce(new Error("sandbox gone"))
      const scoped = createScopedFilesystem(sandbox as never)

      const kind = await scoped.getEntryKind("src/app.ts")

      expect(kind).toBe("unknown")
    })
  })
})
