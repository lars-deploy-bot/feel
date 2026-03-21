/**
 * Tests for file-api.ts client functions: deleteFile and uploadFile
 *
 * Verifies correct HTTP requests are made and error handling works.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const { deleteFile, uploadFile } = await import("../lib/file-api")

describe("file-api client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("deleteFile", () => {
    it("should POST to /api/files/delete with correct body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, deleted: "test.txt", type: "file" }),
      })

      await deleteFile("my-site.alive.best", "test.txt")

      expect(mockFetch).toHaveBeenCalledWith("/api/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: "my-site.alive.best", path: "test.txt" }),
      })
    })

    it("should pass recursive flag", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, deleted: "src", type: "directory" }),
      })

      await deleteFile("my-site.alive.best", "src", { recursive: true })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.recursive).toBe(true)
    })

    it("should pass worktree", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, deleted: "test.txt", type: "file" }),
      })

      await deleteFile("my-site.alive.best", "test.txt", { worktree: "feature" })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.worktree).toBe("feature")
    })

    it("should throw on server error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ ok: false, error: "FILE_PROTECTED" }),
      })

      await expect(deleteFile("my-site.alive.best", "package.json")).rejects.toThrow("FILE_PROTECTED")
    })

    it("should throw on ok:false in response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: "PATH_OUTSIDE_WORKSPACE" }),
      })

      await expect(deleteFile("my-site.alive.best", "../etc/passwd")).rejects.toThrow("PATH_OUTSIDE_WORKSPACE")
    })
  })

  describe("uploadFile", () => {
    it("should POST multipart form to /api/files/upload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            path: ".uploads/test-123.png",
            originalName: "test.png",
            size: 100,
            mimeType: "image/png",
          }),
      })

      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFile("my-site.alive.best", file)

      expect(mockFetch).toHaveBeenCalledWith("/api/files/upload", {
        method: "POST",
        credentials: "include",
        body: expect.any(FormData),
      })

      const body = mockFetch.mock.calls[0][1].body
      expect(body).toBeInstanceOf(FormData)
      const formData = body instanceof FormData ? body : new FormData()
      expect(formData.get("workspace")).toBe("my-site.alive.best")
      expect(formData.get("file")).toBe(file)
    })

    it("should include worktree in form data when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            path: ".uploads/test-123.png",
            originalName: "test.png",
          }),
      })

      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFile("my-site.alive.best", file, "feature-branch")

      const body = mockFetch.mock.calls[0][1].body
      expect(body).toBeInstanceOf(FormData)
      const formData = body instanceof FormData ? body : new FormData()
      expect(formData.get("worktree")).toBe("feature-branch")
    })

    it("should not include worktree when null", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            path: ".uploads/test-123.png",
            originalName: "test.png",
          }),
      })

      const file = new File(["content"], "test.png", { type: "image/png" })
      await uploadFile("my-site.alive.best", file, null)

      const body = mockFetch.mock.calls[0][1].body
      expect(body).toBeInstanceOf(FormData)
      const formData = body instanceof FormData ? body : new FormData()
      expect(formData.get("worktree")).toBeNull()
    })

    it("should return path and originalName from response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            path: ".uploads/photo-456.jpg",
            originalName: "photo.jpg",
          }),
      })

      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" })
      const result = await uploadFile("my-site.alive.best", file)

      expect(result).toEqual({ path: ".uploads/photo-456.jpg", originalName: "photo.jpg" })
    })

    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: "INVALID_FILE_TYPE" } }),
      })

      const file = new File(["content"], "script.js", { type: "application/javascript" })
      await expect(uploadFile("my-site.alive.best", file)).rejects.toThrow("INVALID_FILE_TYPE")
    })

    it("should throw on ok:false in response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: () => Promise.resolve({ message: "File too large" }),
      })

      const file = new File(["x".repeat(100)], "big.txt", { type: "text/plain" })
      await expect(uploadFile("my-site.alive.best", file)).rejects.toThrow("File too large")
    })

    it("should throw generic message when JSON parsing fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })

      const file = new File(["content"], "test.png", { type: "image/png" })
      await expect(uploadFile("my-site.alive.best", file)).rejects.toThrow("Upload failed (500)")
    })
  })
})
