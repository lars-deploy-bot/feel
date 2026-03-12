import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "smol-toml"

// ── Types ──────────────────────────────────────────────────────────────────

export interface AliveToml {
  schema: number
  project: {
    kind: string
    root: string
  }
  setup: {
    command: string
  }
  build: {
    command: string
    outputs?: string[]
  }
  run: {
    development?: { command: string; cwd?: string }
    staging?: { command: string; cwd?: string }
    production?: { command: string; cwd?: string }
  }
}

// ── Validation ─────────────────────────────────────────────────────────────

function assertString(obj: Record<string, unknown>, key: string, context: string): string {
  const val = obj[key]
  if (typeof val !== "string" || val.length === 0) {
    throw new Error(`alive.toml: ${context}.${key} must be a non-empty string`)
  }
  return val
}

function validate(raw: Record<string, unknown>): AliveToml {
  // schema
  if (typeof raw.schema !== "number" || raw.schema !== 1) {
    throw new Error("alive.toml: schema must be 1")
  }

  // project
  const project = raw.project as Record<string, unknown> | undefined
  if (!project || typeof project !== "object") {
    throw new Error("alive.toml: [project] section is required")
  }
  const kind = assertString(project, "kind", "project")
  const root = assertString(project, "root", "project")

  // setup
  const setup = raw.setup as Record<string, unknown> | undefined
  if (!setup || typeof setup !== "object") {
    throw new Error("alive.toml: [setup] section is required")
  }
  const setupCommand = assertString(setup, "command", "setup")

  // build
  const build = raw.build as Record<string, unknown> | undefined
  if (!build || typeof build !== "object") {
    throw new Error("alive.toml: [build] section is required")
  }
  const buildCommand = assertString(build, "command", "build")
  const buildOutputs = Array.isArray(build.outputs) ? (build.outputs as string[]) : undefined

  // run (at least one required)
  const run = raw.run as Record<string, unknown> | undefined
  if (!run || typeof run !== "object") {
    throw new Error("alive.toml: [run] section is required (at least run.development or run.production)")
  }

  const parsedRun: AliveToml["run"] = {}
  for (const env of ["development", "staging", "production"] as const) {
    const entry = run[env] as Record<string, unknown> | undefined
    if (entry && typeof entry === "object") {
      parsedRun[env] = {
        command: assertString(entry, "command", `run.${env}`),
        cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      }
    }
  }

  if (!parsedRun.development && !parsedRun.production) {
    throw new Error("alive.toml: at least run.development or run.production is required")
  }

  return {
    schema: 1,
    project: { kind, root },
    setup: { command: setupCommand },
    build: { command: buildCommand, outputs: buildOutputs },
    run: parsedRun,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Read and parse alive.toml from a site directory.
 * Returns null if the file doesn't exist (backwards-compatible).
 * Throws if the file exists but is invalid.
 */
export function readAliveToml(siteDir: string): AliveToml | null {
  const tomlPath = join(siteDir, "alive.toml")
  if (!existsSync(tomlPath)) {
    return null
  }

  const content = readFileSync(tomlPath, "utf-8")
  const raw = parse(content) as Record<string, unknown>
  return validate(raw)
}

/**
 * Resolve the working directory for a site based on alive.toml.
 * Falls back to "user" if no alive.toml exists.
 */
export function resolveProjectRoot(siteDir: string, toml: AliveToml | null): string {
  const root = toml?.project.root ?? "user"
  return join(siteDir, root)
}

/**
 * Get the run command for the site's mode.
 * Sites run in "development" mode (Vite dev server) by default,
 * or "production" mode if explicitly configured (preview/serve).
 */
export function getRunCommand(toml: AliveToml | null, mode: "development" | "production"): string {
  if (!toml) {
    // Legacy fallback: no alive.toml means old-style Vite site
    return "bun run dev"
  }

  const entry = toml.run[mode]
  if (entry) {
    return entry.command
  }

  // Fall through: if production requested but only development exists, use development
  if (mode === "production" && toml.run.development) {
    return toml.run.development.command
  }
  // Vice versa
  if (mode === "development" && toml.run.production) {
    return toml.run.production.command
  }

  throw new Error(`alive.toml: no run command found for mode "${mode}"`)
}
