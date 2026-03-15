import * as path from "node:path"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { Sandbox } from "e2b"
import { SANDBOX_WORKSPACE_ROOT, type SandboxDomain, type SandboxManager } from "./manager.js"

const SANDBOX_GONE_MESSAGE_PATTERNS = [/\bnot found\b/i, /\bdoes not exist\b/i, /\bno such sandbox\b/i]

export interface SandboxRuntimeFileEntry {
  name: string
  kind: "file" | "directory"
  path: string
}

export interface SandboxRuntimeDeleteResult {
  kind: "file" | "directory" | "unknown"
}

export const DEFAULT_SANDBOX_CONNECT_TIMEOUT_MS = 10_000

export interface ConnectRunningSandboxConfig {
  e2bDomain: string
  connectTimeoutMs: number
  markDeadIfCurrent: (domain: SandboxDomain) => Promise<void>
}

export interface SandboxRuntimeFacadeConfig extends ConnectRunningSandboxConfig {
  manager: SandboxManager
}

export interface ConnectedSandboxRuntime {
  ensureDirectory(domain: SandboxDomain, relativePath: string): Promise<void>
  getEntryKind(domain: SandboxDomain, relativePath: string): Promise<SandboxRuntimeDeleteResult["kind"]>
  writeFile(domain: SandboxDomain, relativePath: string, content: string | ArrayBuffer): Promise<void>
  readTextFile(domain: SandboxDomain, relativePath: string): Promise<string>
  listDirectory(domain: SandboxDomain, relativePath: string): Promise<SandboxRuntimeFileEntry[]>
  writeTextFile(domain: SandboxDomain, relativePath: string, content: string): Promise<void>
  deletePath(domain: SandboxDomain, relativePath: string): Promise<SandboxRuntimeDeleteResult>
}

export interface SandboxRuntimeFacade extends ConnectedSandboxRuntime {
  ensureRunning(domain: SandboxDomain, hostWorkspacePath: string): Promise<string>
}

export class RuntimeNotReadyError extends Error {
  readonly code = "RUNTIME_NOT_READY"
  readonly status: string | null

  constructor(hostname: string, status: string | null) {
    super(`Sandbox for ${hostname} is not ready (status: ${status ?? "none"}).`)
    this.name = "RuntimeNotReadyError"
    this.status = status
  }
}

export class RuntimePathValidationError extends Error {
  readonly code = "RUNTIME_PATH_OUTSIDE_WORKSPACE"
  readonly relativePath: string

  constructor(relativePath: string) {
    super(`Sandbox path must stay within ${SANDBOX_WORKSPACE_ROOT}: ${relativePath}`)
    this.name = "RuntimePathValidationError"
    this.relativePath = relativePath
  }
}

function parseStatusCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function getConnectErrorStatusCode(err: unknown): number | null {
  if (!err || typeof err !== "object") {
    return null
  }

  const directStatus = parseStatusCode(Reflect.get(err, "status"))
  if (directStatus !== null) {
    return directStatus
  }

  const statusCode = parseStatusCode(Reflect.get(err, "statusCode"))
  if (statusCode !== null) {
    return statusCode
  }

  const response = Reflect.get(err, "response")
  if (!response || typeof response !== "object") {
    return null
  }

  return parseStatusCode(Reflect.get(response, "status"))
}

function getConnectErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message
  }

  if (err && typeof err === "object") {
    const message = Reflect.get(err, "message")
    if (typeof message === "string" && message.trim().length > 0) {
      return message
    }

    const statusCode = getConnectErrorStatusCode(err)
    if (statusCode !== null) {
      return `HTTP ${statusCode}`
    }

    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }

  return String(err)
}

function isSandboxDefinitelyGone(err: unknown): boolean {
  const statusCode = getConnectErrorStatusCode(err)
  if (statusCode === 404) {
    return true
  }

  const message = getConnectErrorMessage(err)
  return SANDBOX_GONE_MESSAGE_PATTERNS.some(pattern => pattern.test(message))
}

function normalizeRelativePath(relativePath: string): string {
  return path.posix.normalize(relativePath)
}

function isOutsideWorkspace(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith("../")
}

function normalizeListedPath(relativePath: string, entryName: string): string {
  const normalized = normalizeRelativePath(relativePath)
  if (normalized === "." || normalized === "") {
    return entryName
  }
  return path.posix.join(normalized, entryName)
}

export function resolveSandboxWorkspacePath(relativePath: string, options: { allowWorkspaceRoot: boolean }): string {
  if (relativePath.includes("\u0000")) {
    throw new RuntimePathValidationError(relativePath)
  }

  const normalized = normalizeRelativePath(relativePath)
  if (path.posix.isAbsolute(normalized) || isOutsideWorkspace(normalized)) {
    throw new RuntimePathValidationError(relativePath)
  }

  const sandboxPath =
    normalized === "." || normalized === ""
      ? SANDBOX_WORKSPACE_ROOT
      : path.posix.join(SANDBOX_WORKSPACE_ROOT, normalized)

  if (!options.allowWorkspaceRoot && sandboxPath === SANDBOX_WORKSPACE_ROOT) {
    throw new RuntimePathValidationError(relativePath)
  }

  if (!isPathWithinWorkspace(sandboxPath, SANDBOX_WORKSPACE_ROOT)) {
    throw new RuntimePathValidationError(relativePath)
  }

  return sandboxPath
}

export async function connectRunningSandbox(
  domain: SandboxDomain,
  config: ConnectRunningSandboxConfig,
): Promise<Sandbox> {
  if (!domain.sandbox_id || (domain.sandbox_status !== "running" && domain.sandbox_status !== "paused")) {
    throw new RuntimeNotReadyError(domain.hostname, domain.sandbox_status)
  }

  try {
    return await Sandbox.connect(domain.sandbox_id, {
      domain: config.e2bDomain,
      timeoutMs: config.connectTimeoutMs,
    })
  } catch (err) {
    if (isSandboxDefinitelyGone(err)) {
      try {
        await config.markDeadIfCurrent(domain)
      } catch {
        // Best effort only. The caller still needs a not-ready signal even if the CAS update fails.
      }
      throw new RuntimeNotReadyError(domain.hostname, "dead")
    }

    throw new RuntimeNotReadyError(domain.hostname, domain.sandbox_status)
  }
}

async function detectEntryKind(sandbox: Sandbox, sandboxPath: string): Promise<SandboxRuntimeDeleteResult["kind"]> {
  const parentDir = path.posix.dirname(sandboxPath)
  const baseName = path.posix.basename(sandboxPath)

  try {
    const entries = await sandbox.files.list(parentDir)
    const entry = entries.find(candidate => candidate.name === baseName)
    if (!entry) {
      return "unknown"
    }
    return entry.type === "dir" ? "directory" : "file"
  } catch {
    return "unknown"
  }
}

export function createConnectedSandboxRuntime(config: ConnectRunningSandboxConfig): ConnectedSandboxRuntime {
  const connect = (domain: SandboxDomain) =>
    connectRunningSandbox(domain, {
      e2bDomain: config.e2bDomain,
      connectTimeoutMs: config.connectTimeoutMs,
      markDeadIfCurrent: config.markDeadIfCurrent,
    })

  return {
    async ensureDirectory(domain: SandboxDomain, relativePath: string): Promise<void> {
      const sandbox = await connect(domain)
      const sandboxPath = resolveSandboxWorkspacePath(relativePath, { allowWorkspaceRoot: false })
      try {
        await sandbox.files.makeDir(sandboxPath)
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("exists")) {
          throw error
        }
      }
    },

    async getEntryKind(domain: SandboxDomain, relativePath: string): Promise<SandboxRuntimeDeleteResult["kind"]> {
      const sandbox = await connect(domain)
      const sandboxPath = resolveSandboxWorkspacePath(relativePath, { allowWorkspaceRoot: false })
      return detectEntryKind(sandbox, sandboxPath)
    },

    async writeFile(domain: SandboxDomain, relativePath: string, content: string | ArrayBuffer): Promise<void> {
      const sandbox = await connect(domain)
      const sandboxPath = resolveSandboxWorkspacePath(relativePath, { allowWorkspaceRoot: false })
      await sandbox.files.write(sandboxPath, content)
    },

    async readTextFile(domain: SandboxDomain, relativePath: string): Promise<string> {
      const sandbox = await connect(domain)
      const sandboxPath = resolveSandboxWorkspacePath(relativePath, { allowWorkspaceRoot: false })
      return sandbox.files.read(sandboxPath)
    },

    async listDirectory(domain: SandboxDomain, relativePath: string): Promise<SandboxRuntimeFileEntry[]> {
      const sandbox = await connect(domain)
      const sandboxPath = resolveSandboxWorkspacePath(relativePath, { allowWorkspaceRoot: true })
      const entries = await sandbox.files.list(sandboxPath)

      return entries.map(entry => ({
        name: entry.name,
        kind: entry.type === "dir" ? "directory" : "file",
        path: normalizeListedPath(relativePath, entry.name),
      }))
    },

    async writeTextFile(domain: SandboxDomain, relativePath: string, content: string): Promise<void> {
      await this.writeFile(domain, relativePath, content)
    },

    async deletePath(domain: SandboxDomain, relativePath: string): Promise<SandboxRuntimeDeleteResult> {
      const sandbox = await connect(domain)
      const sandboxPath = resolveSandboxWorkspacePath(relativePath, { allowWorkspaceRoot: false })
      const kind = await detectEntryKind(sandbox, sandboxPath)
      await sandbox.files.remove(sandboxPath)
      return { kind }
    },
  }
}

export function createSandboxRuntimeFacade(config: SandboxRuntimeFacadeConfig): SandboxRuntimeFacade {
  const connectedRuntime = createConnectedSandboxRuntime(config)

  return {
    ...connectedRuntime,
    async ensureRunning(domain: SandboxDomain, hostWorkspacePath: string): Promise<string> {
      if (!hostWorkspacePath) {
        throw new Error("Sandbox runtime ensureRunning requires a host workspace path")
      }

      const sandbox = await config.manager.getOrCreate(domain, hostWorkspacePath)
      return sandbox.sandboxId
    },
  }
}
