import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
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
import { buildBaseConfig } from "./fixtures/server-config-fixture"

function assertRecord(v: unknown): asserts v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) throw new Error(`Expected object, got ${typeof v}`)
}

const CONFIG_MODULE_URL = new URL("../config.ts", import.meta.url).href

function runConfigProbe(envOverrides: Record<string, string | undefined>, options?: { disableRequire?: boolean }) {
  const env = { ...process.env }
  for (const [key, value] of Object.entries(envOverrides)) {
    if (typeof value === "undefined") {
      delete env[key]
    } else {
      env[key] = value
    }
  }

  const prefix = options?.disableRequire ? "globalThis.require = undefined;\n" : ""
  const importStyle = options?.disableRequire
    ? `const mod = await import("${CONFIG_MODULE_URL}");\n` +
      "const { PATHS, SECURITY } = mod;\n" +
      "console.log(JSON.stringify({\n" +
      "  aliveRoot: PATHS.ALIVE_ROOT,\n" +
      "  sitesRoot: PATHS.SITES_ROOT,\n" +
      "  allowedBases: [...SECURITY.ALLOWED_WORKSPACE_BASES]\n" +
      "}));"
    : `import { DOMAINS, PATHS, SECURITY, SUPERADMIN } from "${CONFIG_MODULE_URL}";\n` +
      "console.log(JSON.stringify({\n" +
      "  aliveRoot: PATHS.ALIVE_ROOT,\n" +
      "  e2bScratchRoot: PATHS.E2B_SCRATCH_ROOT,\n" +
      "  sitesRoot: PATHS.SITES_ROOT,\n" +
      "  imagesStorage: PATHS.IMAGES_STORAGE,\n" +
      "  mainDomain: DOMAINS.MAIN,\n" +
      "  mainSuffix: DOMAINS.MAIN_SUFFIX,\n" +
      "  allowedBases: [...SECURITY.ALLOWED_WORKSPACE_BASES],\n" +
      "  workspacePath: SUPERADMIN.WORKSPACE_PATH\n" +
      "}));"

  const script = prefix + importStyle

  return spawnSync("bun", ["-e", script], { env, encoding: "utf8", timeout: 10_000, cwd: tmpdir() })
}

function writeServerConfig(rawConfig: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "alive-config-probe-"))
  writeFileSync(join(dir, "server-config.json"), JSON.stringify(rawConfig))
  return dir
}

describe("resolveTemplatePath", () => {
  // TEMPLATES_ROOT comes from server-config.json via requireConfig().
  // In test env (VITEST=true) without SERVER_CONFIG_PATH, it defaults to "".
  // Use the runtime value for assertions; skip happy-path tests when unconfigured.
  const TEMPLATES_ROOT = PATHS.TEMPLATES_ROOT
  const hasTemplatesRoot = TEMPLATES_ROOT.length > 0

  it("throws when TEMPLATES_ROOT is not configured", () => {
    if (hasTemplatesRoot) return // only testable when TEMPLATES_ROOT is empty
    expect(() => resolveTemplatePath("blank.test.example")).toThrow("TEMPLATES_ROOT is not configured")
  })

  it.skipIf(!hasTemplatesRoot)("extracts directory name from a DB source_path", () => {
    const result = resolveTemplatePath(`${TEMPLATES_ROOT}/blank.test.example`)
    expect(result).toBe(`${TEMPLATES_ROOT}/blank.test.example`)
  })

  it.skipIf(!hasTemplatesRoot)("handles a simple directory name", () => {
    const result = resolveTemplatePath("blank.test.example")
    expect(result).toBe(`${TEMPLATES_ROOT}/blank.test.example`)
  })

  it.skipIf(!hasTemplatesRoot)("extracts last segment from multi-level path", () => {
    const result = resolveTemplatePath("/some/deep/path/template-dir")
    expect(result).toBe(`${TEMPLATES_ROOT}/template-dir`)
  })

  it.skipIf(!hasTemplatesRoot)("throws for empty string input", () => {
    expect(() => resolveTemplatePath("")).toThrow("Invalid template source_path")
  })

  it.skipIf(!hasTemplatesRoot)("handles path traversal attempts — extracts only last segment", () => {
    const result = resolveTemplatePath("../../etc/passwd")
    expect(result).toBe(`${TEMPLATES_ROOT}/passwd`)
    expect(result.startsWith(TEMPLATES_ROOT)).toBe(true)
  })

  it.skipIf(!hasTemplatesRoot)("throws for '..' as the final segment", () => {
    expect(() => resolveTemplatePath("/foo/bar/..")).toThrow("Invalid template source_path")
  })

  it.skipIf(!hasTemplatesRoot)("throws for '.' as input", () => {
    expect(() => resolveTemplatePath(".")).toThrow("Invalid template source_path")
  })

  it.skipIf(!hasTemplatesRoot)("throws for trailing slash (empty last segment)", () => {
    expect(() => resolveTemplatePath("/foo/bar/")).toThrow("Invalid template source_path")
  })
})

describe("local/standalone config defaults", () => {
  it("uses local defaults when ALIVE_ENV=local and SERVER_CONFIG_PATH is unset", () => {
    const home = `/tmp/alive-config-test-${Date.now()}`
    const result = runConfigProbe({
      ALIVE_ENV: "local",
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

  it("uses local defaults when ALIVE_ENV=standalone and SERVER_CONFIG_PATH is unset", () => {
    const home = `/tmp/alive-config-test-${Date.now()}`
    const result = runConfigProbe({
      ALIVE_ENV: "standalone",
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
      ALIVE_ENV: "local",
      SERVER_CONFIG_PATH: missingPath,
      CI: undefined,
      VITEST: undefined,
    })

    expect(result.status).not.toBe(0)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain(`Server config not found at ${missingPath}`)
  })

  it("loads server config when require is unavailable but process.getBuiltinModule exists", () => {
    const configDir = writeServerConfig(
      buildBaseConfig({
        tunnel: {
          accountId: "cf-account",
          tunnelId: "055f6248-5434-487c-a074-f9fab9aa6fe1",
          apiToken: "cf-token",
          zoneId: "cf-zone",
        },
      }),
    )

    try {
      const result = runConfigProbe(
        {
          ALIVE_ENV: "production",
          SERVER_CONFIG_PATH: join(configDir, "server-config.json"),
          CI: undefined,
          VITEST: undefined,
        },
        { disableRequire: true },
      )

      expect(result.status).toBe(0)
      const parsed: unknown = JSON.parse(result.stdout)
      expect(parsed).toMatchObject({
        aliveRoot: "/root/alive",
        sitesRoot: "/srv/webalive/sites",
        allowedBases: ["/srv/webalive/sites"],
      })
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  })
})

describe("E2B config validation", () => {
  it("fails fast when E2B is enabled without paths.e2bScratchRoot", () => {
    const configDir = writeServerConfig(buildBaseConfig())

    try {
      const result = runConfigProbe({
        ALIVE_ENV: "staging",
        SERVER_CONFIG_PATH: join(configDir, "server-config.json"),
        NEW_SITE_EXECUTION_MODE: "e2b",
        CI: undefined,
        VITEST: undefined,
      })

      expect(result.status).not.toBe(0)
      expect(`${result.stdout}\n${result.stderr}`).toContain("paths.e2bScratchRoot is required")
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  })

  it("allows E2B when paths.e2bScratchRoot is configured", () => {
    const configDir = writeServerConfig(
      buildBaseConfig({
        paths: {
          aliveRoot: "/root/alive",
          sitesRoot: "/srv/webalive/sites",
          templatesRoot: "/srv/webalive/templates",
          imagesStorage: "/srv/webalive/storage",
          e2bScratchRoot: "/srv/webalive/e2b-scratch",
        },
      }),
    )

    try {
      const result = runConfigProbe({
        ALIVE_ENV: "staging",
        SERVER_CONFIG_PATH: join(configDir, "server-config.json"),
        E2B_DOMAIN: "e2b.example.com",
        CI: undefined,
        VITEST: undefined,
      })

      expect(result.status).toBe(0)
      const parsed: unknown = JSON.parse(result.stdout)
      assertRecord(parsed)
      expect(parsed.allowedBases).toEqual(["/srv/webalive/sites", "/srv/webalive/e2b-scratch"])
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  })

  it("does not fail host-mode config when shared E2B secrets exist but new sites stay on systemd", () => {
    const configDir = writeServerConfig(buildBaseConfig())

    try {
      const result = runConfigProbe({
        ALIVE_ENV: "staging",
        SERVER_CONFIG_PATH: join(configDir, "server-config.json"),
        E2B_DOMAIN: "e2b.example.com",
        E2B_API_KEY: "shared-secret",
        NEW_SITE_EXECUTION_MODE: "systemd",
        CI: undefined,
        VITEST: undefined,
      })

      expect(result.status).toBe(0)
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  })

  it("provides a local E2B scratch root when local mode enables E2B execution", () => {
    const home = `/tmp/alive-config-test-${Date.now()}`
    const result = runConfigProbe({
      ALIVE_ENV: "local",
      HOME: home,
      SERVER_CONFIG_PATH: undefined,
      NEW_SITE_EXECUTION_MODE: "e2b",
      CI: undefined,
      VITEST: undefined,
    })

    expect(result.status).toBe(0)
    const parsed: unknown = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      e2bScratchRoot: `${home}/.alive/e2b-scratch`,
      allowedBases: [`${home}/.alive/workspaces`, `${home}/.alive/e2b-scratch`],
    })
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
  const hasServerConfig = !!process.env.SERVER_CONFIG_PATH

  it("test env returns empty config when SERVER_CONFIG_PATH is unset", () => {
    if (hasServerConfig) {
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
    expect(isAliveWorkspace("test.test.example")).toBe(false)
    expect(isAliveWorkspace("")).toBe(false)
  })

  it("is case-sensitive", () => {
    expect(isAliveWorkspace("Alive")).toBe(false)
    expect(isAliveWorkspace("ALIVE")).toBe(false)
  })
})
