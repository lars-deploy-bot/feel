import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { getRunCommand, readAliveToml, resolveProjectRoot } from "../src/alive-toml"

describe("alive-toml", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "alive-toml-test-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe("readAliveToml", () => {
    it("returns null when no alive.toml exists", () => {
      expect(readAliveToml(dir)).toBeNull()
    })

    it("parses a valid alive.toml", () => {
      writeFileSync(
        join(dir, "alive.toml"),
        `schema = 1
[project]
kind = "vite"
root = "user"
[setup]
command = "bun install"
[build]
command = "bun run build"
outputs = ["dist"]
[run.development]
command = "bun run dev"
[run.production]
command = "bun run preview"
`,
      )

      const toml = readAliveToml(dir)
      expect(toml).not.toBeNull()
      expect(toml!.schema).toBe(1)
      expect(toml!.project.kind).toBe("vite")
      expect(toml!.project.root).toBe("user")
      expect(toml!.setup.command).toBe("bun install")
      expect(toml!.build.command).toBe("bun run build")
      expect(toml!.build.outputs).toEqual(["dist"])
      expect(toml!.run.development!.command).toBe("bun run dev")
      expect(toml!.run.production!.command).toBe("bun run preview")
    })

    it("throws on invalid schema version", () => {
      writeFileSync(
        join(dir, "alive.toml"),
        `schema = 2
[project]
kind = "vite"
root = "user"
[setup]
command = "bun install"
[build]
command = "bun run build"
[run.development]
command = "bun run dev"
`,
      )

      expect(() => readAliveToml(dir)).toThrow("schema must be 1")
    })

    it("throws when missing required sections", () => {
      writeFileSync(join(dir, "alive.toml"), "schema = 1\n")
      expect(() => readAliveToml(dir)).toThrow("[project] section is required")
    })

    it("throws when no run commands exist", () => {
      writeFileSync(
        join(dir, "alive.toml"),
        `schema = 1
[project]
kind = "vite"
root = "user"
[setup]
command = "bun install"
[build]
command = "bun run build"
[run]
`,
      )

      expect(() => readAliveToml(dir)).toThrow("at least run.development or run.production")
    })

    it("accepts only run.development without run.production", () => {
      writeFileSync(
        join(dir, "alive.toml"),
        `schema = 1
[project]
kind = "vite"
root = "user"
[setup]
command = "bun install"
[build]
command = "bun run build"
[run.development]
command = "bun run dev"
`,
      )

      const toml = readAliveToml(dir)
      expect(toml!.run.development!.command).toBe("bun run dev")
      expect(toml!.run.production).toBeUndefined()
    })
  })

  describe("resolveProjectRoot", () => {
    it("returns project.root from toml", () => {
      const result = resolveProjectRoot("/srv/sites/example.com", {
        schema: 1,
        project: { kind: "vite", root: "src" },
        setup: { command: "bun install" },
        build: { command: "bun run build" },
        run: { development: { command: "bun run dev" } },
      })
      expect(result).toBe("/srv/sites/example.com/src")
    })

    it("defaults to 'user' when toml is null", () => {
      const result = resolveProjectRoot("/srv/sites/example.com", null)
      expect(result).toBe("/srv/sites/example.com/user")
    })
  })

  describe("getRunCommand", () => {
    it("returns the requested mode's command", () => {
      const toml = {
        schema: 1 as const,
        project: { kind: "vite", root: "user" },
        setup: { command: "bun install" },
        build: { command: "bun run build" },
        run: {
          development: { command: "bun run dev" },
          production: { command: "bun run preview" },
        },
      }

      expect(getRunCommand(toml, "development")).toBe("bun run dev")
      expect(getRunCommand(toml, "production")).toBe("bun run preview")
    })

    it("falls back to development when production not defined", () => {
      const toml = {
        schema: 1 as const,
        project: { kind: "vite", root: "user" },
        setup: { command: "bun install" },
        build: { command: "bun run build" },
        run: { development: { command: "bun run dev" } },
      }

      expect(getRunCommand(toml, "production")).toBe("bun run dev")
    })

    it("returns legacy default when toml is null", () => {
      expect(getRunCommand(null, "development")).toBe("bun run dev")
      expect(getRunCommand(null, "production")).toBe("bun run dev")
    })
  })
})
