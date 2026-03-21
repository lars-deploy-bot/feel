/**
 * Tests for file-ops.ts: removeFile and uploadFileToWorkspace
 *
 * Verifies that high-level operations properly:
 * - Call the underlying API functions
 * - Invalidate the correct caches
 * - Notify subscribers of changes
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the underlying API module
vi.mock("../lib/file-api", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  uploadFile: vi.fn().mockResolvedValue({ path: ".uploads/test-123.png", originalName: "test.png" }),
}))

// Mock cache module
vi.mock("../lib/file-cache", () => ({
  invalidateContent: vi.fn(),
  invalidateList: vi.fn(),
}))

// Mock events module
vi.mock("../lib/file-events", () => ({
  notifyFileChange: vi.fn(),
}))

const { deleteFile, uploadFile } = await import("../lib/file-api")
const { invalidateContent, invalidateList } = await import("../lib/file-cache")
const { notifyFileChange } = await import("../lib/file-events")
const { removeFile, uploadFileToWorkspace, saveFile } = await import("../lib/file-ops")

describe("file-ops", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("removeFile", () => {
    it("should call deleteFile with correct arguments", async () => {
      await removeFile("my-site.alive.best", "src/old.ts", { worktree: null, recursive: false })

      expect(deleteFile).toHaveBeenCalledWith("my-site.alive.best", "src/old.ts", {
        worktree: null,
        recursive: false,
      })
    })

    it("should invalidate content cache for the deleted path", async () => {
      await removeFile("my-site.alive.best", "src/old.ts")

      expect(invalidateContent).toHaveBeenCalledWith("my-site.alive.best", undefined, "src/old.ts")
    })

    it("should invalidate list cache for the parent directory", async () => {
      await removeFile("my-site.alive.best", "src/components/Button.tsx")

      expect(invalidateList).toHaveBeenCalledWith("my-site.alive.best", undefined, "src/components")
    })

    it("should invalidate list cache for root when deleting root-level file", async () => {
      await removeFile("my-site.alive.best", "README.md")

      expect(invalidateList).toHaveBeenCalledWith("my-site.alive.best", undefined, "")
    })

    it("should notify subscribers of the change", async () => {
      await removeFile("my-site.alive.best", "test.txt")

      expect(notifyFileChange).toHaveBeenCalledOnce()
    })

    it("should pass recursive flag for directory deletion", async () => {
      await removeFile("my-site.alive.best", "src/old-folder", { recursive: true })

      expect(deleteFile).toHaveBeenCalledWith("my-site.alive.best", "src/old-folder", {
        recursive: true,
      })
    })

    it("should pass worktree when provided", async () => {
      await removeFile("my-site.alive.best", "test.txt", { worktree: "feature-branch" })

      expect(deleteFile).toHaveBeenCalledWith("my-site.alive.best", "test.txt", {
        worktree: "feature-branch",
      })
      expect(invalidateContent).toHaveBeenCalledWith("my-site.alive.best", "feature-branch", "test.txt")
    })

    it("should propagate errors from deleteFile", async () => {
      vi.mocked(deleteFile).mockRejectedValueOnce(new Error("FILE_PROTECTED"))

      await expect(removeFile("my-site.alive.best", "package.json")).rejects.toThrow("FILE_PROTECTED")
    })

    it("should not invalidate cache or notify on error", async () => {
      vi.mocked(deleteFile).mockRejectedValueOnce(new Error("fail"))

      await expect(removeFile("my-site.alive.best", "test.txt")).rejects.toThrow()

      expect(invalidateContent).not.toHaveBeenCalled()
      expect(invalidateList).not.toHaveBeenCalled()
      expect(notifyFileChange).not.toHaveBeenCalled()
    })
  })

  describe("uploadFileToWorkspace", () => {
    it("should call uploadFile with correct arguments", async () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFileToWorkspace("my-site.alive.best", file, null)

      expect(uploadFile).toHaveBeenCalledWith("my-site.alive.best", file, null)
    })

    it("should return the path and originalName from the API", async () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      const result = await uploadFileToWorkspace("my-site.alive.best", file)

      expect(result).toEqual({ path: ".uploads/test-123.png", originalName: "test.png" })
    })

    it("should invalidate .uploads directory listing", async () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFileToWorkspace("my-site.alive.best", file)

      expect(invalidateList).toHaveBeenCalledWith("my-site.alive.best", undefined, ".uploads")
    })

    it("should invalidate root directory listing (for new .uploads dir)", async () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFileToWorkspace("my-site.alive.best", file)

      expect(invalidateList).toHaveBeenCalledWith("my-site.alive.best", undefined, "")
    })

    it("should notify subscribers of the change", async () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFileToWorkspace("my-site.alive.best", file)

      expect(notifyFileChange).toHaveBeenCalledOnce()
    })

    it("should pass worktree when provided", async () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFileToWorkspace("my-site.alive.best", file, "feature-branch")

      expect(uploadFile).toHaveBeenCalledWith("my-site.alive.best", file, "feature-branch")
      expect(invalidateList).toHaveBeenCalledWith("my-site.alive.best", "feature-branch", ".uploads")
    })

    it("should propagate errors from uploadFile", async () => {
      vi.mocked(uploadFile).mockRejectedValueOnce(new Error("FILE_TOO_LARGE"))
      const file = new File(["x".repeat(11 * 1024 * 1024)], "big.txt", { type: "text/plain" })

      await expect(uploadFileToWorkspace("my-site.alive.best", file)).rejects.toThrow("FILE_TOO_LARGE")
    })

    it("should not invalidate cache or notify on error", async () => {
      vi.mocked(uploadFile).mockRejectedValueOnce(new Error("fail"))
      const file = new File(["content"], "test.png", { type: "image/png" })

      await expect(uploadFileToWorkspace("my-site.alive.best", file)).rejects.toThrow()

      expect(invalidateList).not.toHaveBeenCalled()
      expect(notifyFileChange).not.toHaveBeenCalled()
    })
  })

  describe("saveFile (existing, verify not broken)", () => {
    it("should still work correctly", async () => {
      const { writeFile } = await import("../lib/file-api")
      await saveFile("my-site.alive.best", "src/app.ts", "console.log('hello')")

      expect(writeFile).toHaveBeenCalledWith("my-site.alive.best", "src/app.ts", "console.log('hello')", undefined)
      expect(invalidateContent).toHaveBeenCalledWith("my-site.alive.best", undefined, "src/app.ts")
      expect(invalidateList).toHaveBeenCalledWith("my-site.alive.best", undefined, "src")
      expect(notifyFileChange).toHaveBeenCalled()
    })
  })
})
