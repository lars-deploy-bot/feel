import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/lib/workspace-validator.js", () => ({
  validateWorkspacePath: vi.fn(),
}))

import { sandboxedFsBashTool, sandboxedFsReadTool, sandboxedFsWriteTool } from "../src/tools/sandboxed-fs/index.js"

describe.sequential("sandboxed fs tools", () => {
  const originalCwd = process.cwd()
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), "alive-sandboxed-fs-"))
    process.chdir(workspaceRoot)
  })

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it("blocks read path traversal outside workspace", async () => {
    const result = await sandboxedFsReadTool.handler({
      file_path: "/etc/passwd",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: "text",
    })
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Path must stay within workspace")
    }
  })

  it("blocks writes through symlinked directories that escape workspace", async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "alive-sandboxed-fs-outside-"))
    const linkedDir = join(workspaceRoot, "linked")
    symlinkSync(outsideDir, linkedDir)

    const result = await sandboxedFsWriteTool.handler({
      file_path: join(linkedDir, "escaped.txt"),
      content: "blocked",
    })

    expect(result.isError).toBe(true)
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Write path escapes workspace boundary")
    }
  })

  it("blocks writes to symlinked files that escape workspace", async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "alive-sandboxed-fs-outside-file-"))
    const outsideFile = join(outsideDir, "outside.txt")
    writeFileSync(outsideFile, "original", "utf8")

    const linkedFile = join(workspaceRoot, "linked-file.txt")
    symlinkSync(outsideFile, linkedFile)

    const result = await sandboxedFsWriteTool.handler({
      file_path: linkedFile,
      content: "blocked",
    })

    expect(result.isError).toBe(true)
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Write target escapes workspace boundary")
    }
    expect(readFileSync(outsideFile, "utf8")).toBe("original")
  })

  it("blocks writes to dangling symlinks that point outside workspace", async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "alive-sandboxed-fs-outside-dangling-"))
    const danglingTarget = join(outsideDir, "missing.txt")
    const linkedFile = join(workspaceRoot, "dangling-link.txt")
    symlinkSync(danglingTarget, linkedFile)

    const result = await sandboxedFsWriteTool.handler({
      file_path: linkedFile,
      content: "blocked",
    })

    expect(result.isError).toBe(true)
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Write target escapes workspace boundary")
    }
  })

  it("blocks heavy bash commands", async () => {
    const result = await sandboxedFsBashTool.handler({
      command: "bun run static-check",
    })

    expect(result.isError).toBe(true)
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Command blocked by policy")
    }
  })

  it("allows lightweight bash commands", async () => {
    const result = await sandboxedFsBashTool.handler({
      command: "echo sandbox-ok",
    })

    expect(result.isError).toBe(false)
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("sandbox-ok")
    }
  })

  it("reads workspace files with line numbers", async () => {
    const filePath = join(workspaceRoot, "notes.txt")
    writeFileSync(filePath, "first\nsecond\nthird", "utf8")

    const result = await sandboxedFsReadTool.handler({
      file_path: filePath,
      offset: 2,
      limit: 1,
    })

    expect(result.isError).toBe(false)
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("2\tsecond")
      expect(result.content[0].text).not.toContain("1\tfirst")
    }
  })

  it("writes workspace files", async () => {
    const filePath = join(workspaceRoot, "nested", "file.txt")
    mkdirSync(join(workspaceRoot, "nested"), { recursive: true })

    const result = await sandboxedFsWriteTool.handler({
      file_path: filePath,
      content: "hello",
    })

    expect(result.isError).toBe(false)
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Successfully wrote")
    }
  })
})
