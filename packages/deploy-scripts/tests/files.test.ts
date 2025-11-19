import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { promises as fs } from "fs"
import { mkdtemp } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { ensureDir, copyDir } from "../src/files"

describe("File Operations", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "deploy-test-"))
  })

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("ensureDir", () => {
    it("should create a directory if it doesn't exist", async () => {
      const newDir = join(testDir, "new-dir")
      await ensureDir(newDir)

      const stat = await fs.stat(newDir)
      expect(stat.isDirectory()).toBe(true)
    })

    it("should not fail if directory already exists", async () => {
      const existingDir = join(testDir, "existing")
      await ensureDir(existingDir)
      // Should not throw
      await ensureDir(existingDir)

      const stat = await fs.stat(existingDir)
      expect(stat.isDirectory()).toBe(true)
    })

    it("should create nested directories", async () => {
      const nestedDir = join(testDir, "level1", "level2", "level3")
      await ensureDir(nestedDir)

      const stat = await fs.stat(nestedDir)
      expect(stat.isDirectory()).toBe(true)
    })
  })

  describe("copyDir", () => {
    it("should copy files from source to destination", async () => {
      const srcDir = join(testDir, "src")
      const dstDir = join(testDir, "dst")

      // Create source structure
      await ensureDir(srcDir)
      await fs.writeFile(join(srcDir, "file1.txt"), "content1")
      await fs.writeFile(join(srcDir, "file2.txt"), "content2")

      // Copy
      await copyDir(srcDir, dstDir)

      // Verify
      const file1 = await fs.readFile(join(dstDir, "file1.txt"), "utf-8")
      const file2 = await fs.readFile(join(dstDir, "file2.txt"), "utf-8")

      expect(file1).toBe("content1")
      expect(file2).toBe("content2")
    })

    it("should copy nested directories", async () => {
      const srcDir = join(testDir, "src")
      const dstDir = join(testDir, "dst")

      // Create source structure
      await ensureDir(join(srcDir, "subdir"))
      await fs.writeFile(join(srcDir, "subdir", "nested.txt"), "nested content")

      // Copy
      await copyDir(srcDir, dstDir)

      // Verify
      const content = await fs.readFile(join(dstDir, "subdir", "nested.txt"), "utf-8")
      expect(content).toBe("nested content")
    })
  })
})
