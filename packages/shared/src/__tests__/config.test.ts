import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  DOMAINS,
  isAliveWorkspace,
  PATHS,
  resolveLocalAliveRoot,
  resolveTemplatePath,
  SECURITY,
  SENTRY,
  SUPERADMIN,
} from "../config"

function assertRecord(v: unknown): asserts v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) throw new Error(`Expected object, got ${typeof v}`)
}

const CONFIG_MODULE_URL = new URL("../config.ts", import.meta.url).href

function runConfigProbe(envOverrides: Record<string, string | undefined>) {
  const env = { ...process.env }
  for (const [key, value] of Object.entries(envOverrides)) {
    if (typeof value === "undefined") {
      delete env[key]
    } else {
      env[key] = value
    }
  }

  const script = `
import { DOMAINS, PATHS, SECURITY, SUPERADMIN } from "${CONFIG_MODULE_URL}";
console.log(JSON.stringify({
  aliveRoot: PATHS.ALIVE_ROOT,
  sitesRoot: PATHS.SITES_ROOT,
  imagesStorage: PATHS.IMAGES_STORAGE,
  mainDomain: DOMAINS.MAIN,
  mainSuffix: DOMAINS.MAIN_SUFFIX,
  allowedBases: [...SECURITY.ALLOWED_WORKSPACE_BASES],
  workspacePath: SUPERADMIN.WORKSPACE_PATH
}));
`

  return spawnSync("bun", ["-e", script], { env, encoding: "utf8", timeout: 10_000 })
}

describe("resolveTemplatePath", () => {
  // In test environment, TEMPLATES_ROOT defaults to "/srv/webalive/templates"
  const TEMPLATES_ROOT = "/srv/webalive/templates"

  it("extracts directory name from a DB source_path", () => {
    // DB stores: "/srv/webalive/templates/blank.alive.best"
    // Function extracts last segment "blank.alive.best" and joins with TEMPLATES_ROOT
    const result = resolveTemplatePath("/srv/webalive/templates/blank.alive.best")
    expect(result).toBe(`${TEMPLATES_ROOT}/blank.alive.best`)
  })

  it("handles a simple directory name", () => {
    const result = resolveTemplatePath("blank.alive.best")
    expect(result).toBe(`${TEMPLATES_ROOT}/blank.alive.best`)
  })

  it("extracts last segment from multi-level path", () => {
    const result = resolveTemplatePath("/some/deep/path/template-dir")
    expect(result).toBe(`${TEMPLATES_ROOT}/template-dir`)
  })

  it("throws for empty string input", () => {
    expect(() => resolveTemplatePath("")).toThrow("Invalid template source_path")
  })

  it("handles path traversal attempts — extracts only last segment", () => {
    // Even with traversal in the input, only the last segment is used
    const result = resolveTemplatePath("../../etc/passwd")
    expect(result).toBe(`${TEMPLATES_ROOT}/passwd`)
    // Crucially, the result stays under TEMPLATES_ROOT
    expect(result.startsWith(TEMPLATES_ROOT)).toBe(true)
  })

  it("throws for '..' as the final segment", () => {
    expect(() => resolveTemplatePath("/foo/bar/..")).toThrow("Invalid template source_path")
  })

  it("throws for '.' as input", () => {
    expect(() => resolveTemplatePath(".")).toThrow("Invalid template source_path")
  })

  it("throws for trailing slash (empty last segment)", () => {
    expect(() => resolveTemplatePath("/foo/bar/")).toThrow("Invalid template source_path")
  })
})

describe("local/standalone config defaults", () => {
  it("uses local defaults when STREAM_ENV=local and SERVER_CONFIG_PATH is unset", () => {
    const home = `/tmp/alive-config-test-${Date.now()}`
    const result = runConfigProbe({
      STREAM_ENV: "local",
      HOME: home,
      SERVER_CONFIG_PATH: undefined,
      CI: undefined,
      VITEST: undefined,
    })

    expect(result.status).toBe(0)
    const parsed: unknown = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      sitesRoot: `${home}/.alive/workspaces`,
      imagesStorage: `${home}/.alive/storage`,
      mainDomain: "localhost",
      mainSuffix: ".localhost",
      allowedBases: [`${home}/.alive/workspaces`],
    })
    assertRecord(parsed)
    expect(parsed.workspacePath).toBe(parsed.aliveRoot)
    expect(parsed.aliveRoot).toBeTruthy()
    expect(parsed.aliveRoot).not.toContain("%20")
  })

  it("uses local defaults when STREAM_ENV=standalone and SERVER_CONFIG_PATH is unset", () => {
    const home = `/tmp/alive-config-test-${Date.now()}`
    const result = runConfigProbe({
      STREAM_ENV: "standalone",
      HOME: home,
      SERVER_CONFIG_PATH: undefined,
      CI: undefined,
      VITEST: undefined,
    })

    expect(result.status).toBe(0)
    const parsed: unknown = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      sitesRoot: `${home}/.alive/workspaces`,
      mainDomain: "localhost",
      mainSuffix: ".localhost",
      allowedBases: [`${home}/.alive/workspaces`],
    })
  })

  it("fails fast in local mode when SERVER_CONFIG_PATH is explicitly set but missing", () => {
    const missingPath = `/tmp/missing-server-config-${Date.now()}.json`
    const result = runConfigProbe({
      STREAM_ENV: "local",
      SERVER_CONFIG_PATH: missingPath,
      CI: undefined,
      VITEST: undefined,
    })

    expect(result.status).not.toBe(0)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain(`Server config not found at ${missingPath}`)
  })
})

describe("resolveLocalAliveRoot", () => {
  it("extracts repo root from file:// module url", () => {
    const root = resolveLocalAliveRoot("file:///Users/dev/alive/packages/shared/src/config.ts", "/tmp/fallback")
    expect(root).toBe("/Users/dev/alive")
  })

  it("extracts repo root from absolute path module url", () => {
    const root = resolveLocalAliveRoot("/Users/dev/alive/packages/shared/dist/config.js", "/tmp/fallback")
    expect(root).toBe("/Users/dev/alive")
  })

  it("falls back to cwd discovery for non-file bundled urls", () => {
    const knownCwd = new URL(".", import.meta.url).pathname
    const root = resolveLocalAliveRoot("/_next/static/media/index.69a18fca.js", knownCwd)
    expect(existsSync(join(root, "turbo.json"))).toBe(true)
    expect(existsSync(join(root, "packages", "shared", "src", "config.ts"))).toBe(true)
  })
})

describe("config values in test environment", () => {
  // When SERVER_CONFIG_PATH is set and the file exists, real config values are loaded
  // even in test env. These tests only apply when no config path is set.
  const hasServerConfig = !!process.env.SERVER_CONFIG_PATH

  it("test env returns empty config when SERVER_CONFIG_PATH is unset", () => {
    if (hasServerConfig) {
      // Config was loaded from file — values are non-empty
      expect(PATHS.ALIVE_ROOT).toBeTruthy()
      expect(PATHS.SITES_ROOT).toBeTruthy()
      expect(DOMAINS.MAIN).toBeTruthy()
    } else {
      expect(PATHS.ALIVE_ROOT).toBe("")
      expect(PATHS.SITES_ROOT).toBe("")
      expect(DOMAINS.MAIN).toBe("")
    }
  })

  it("ALLOWED_WORKSPACE_BASES matches environment", () => {
    if (hasServerConfig) {
      expect(SECURITY.ALLOWED_WORKSPACE_BASES.length).toBeGreaterThan(0)
    } else {
      // Without server-config, both SITES_ROOT and E2B_SCRATCH_ROOT are empty.
      // No fallbacks — if paths aren't configured, no workspace bases are allowed.
      expect(SECURITY.ALLOWED_WORKSPACE_BASES).toEqual([])
    }
  })
})

describe("SENTRY config", () => {
  const hasServerConfig = !!process.env.SERVER_CONFIG_PATH

  it("has empty strings when SERVER_CONFIG_PATH is unset, populated when set", () => {
    if (hasServerConfig) {
      expect(SENTRY.DSN).toBeTruthy()
      expect(SENTRY.URL).toBeTruthy()
      expect(SENTRY.HOST).toBeTruthy()
      expect(SENTRY.PROJECT_ID).toBeTruthy()
      expect(typeof SENTRY.ORG).toBe("string")
      expect(typeof SENTRY.PROJECT).toBe("string")
    } else {
      expect(SENTRY.DSN).toBe("")
      expect(SENTRY.URL).toBe("")
      expect(SENTRY.HOST).toBe("")
    }
  })
})

describe("isAliveWorkspace", () => {
  it("returns true for the alive workspace name", () => {
    expect(isAliveWorkspace(SUPERADMIN.WORKSPACE_NAME)).toBe(true)
    expect(isAliveWorkspace("alive")).toBe(true)
  })

  it("returns false for regular site hostnames", () => {
    expect(isAliveWorkspace("example.com")).toBe(false)
    expect(isAliveWorkspace("test.alive.best")).toBe(false)
    expect(isAliveWorkspace("")).toBe(false)
  })

  it("is case-sensitive", () => {
    expect(isAliveWorkspace("Alive")).toBe(false)
    expect(isAliveWorkspace("ALIVE")).toBe(false)
  })
})
