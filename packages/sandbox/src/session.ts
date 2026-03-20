/**
 * Sandbox Session
 *
 * A domain-bound object that owns everything: connected sandbox, path-validated
 * file ops, commands with workspace-root cwd, MCP server creation, and DB-synced
 * lifecycle methods.
 *
 * Callers get a session from a registry and use it for all sandbox operations.
 * The session makes the wrong thing impossible — path security is enforced,
 * DB sync is automatic on pause/kill.
 */

import type { Sandbox } from "e2b"
import { SANDBOX_WORKSPACE_ROOT, type SandboxManager } from "./manager.js"
import type { ScopedFilesystem } from "./scoped-files.js"
import { createScopedFilesystem } from "./scoped-files.js"

export interface SandboxSessionDomain {
  readonly domain_id: string
  readonly hostname: string
}

export interface SandboxCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface SandboxCommandHandle {
  pid: number
}

export interface SandboxSessionCommands {
  /**
   * Run a command. cwd defaults to SANDBOX_WORKSPACE_ROOT.
   *
   * When `background: true`, returns immediately with a synthetic `exitCode: 0`
   * that does NOT reflect actual command completion — the process continues
   * running in the sandbox. Use for long-lived processes like dev servers.
   */
  run(
    cmd: string,
    options?: {
      cwd?: string
      timeoutMs?: number
      background?: boolean
    },
  ): Promise<SandboxCommandResult>
}

export interface SandboxSession {
  /** The domain this session is bound to. */
  readonly domain: SandboxSessionDomain

  /** The E2B sandbox ID. */
  readonly sandboxId: string

  /**
   * Path-validated file operations.
   * Paths are relative to the workspace root.
   * Traversal throws RuntimePathValidationError.
   */
  readonly files: ScopedFilesystem

  /**
   * Command execution. cwd defaults to SANDBOX_WORKSPACE_ROOT.
   */
  readonly commands: SandboxSessionCommands

  /**
   * Escape hatch: the raw E2B Sandbox.
   * Use only for deployment/admin operations that need direct SDK access.
   */
  readonly raw: Sandbox

  /**
   * Get the host address for a sandbox port.
   * Use for preview URLs.
   */
  getHost(port: number): string

  /**
   * Pause the sandbox. Updates DB status to "paused".
   */
  pause(): Promise<void>

  /**
   * Kill the sandbox. Updates DB status to "dead".
   */
  kill(): Promise<void>
}

export function createSandboxSession(
  domain: SandboxSessionDomain,
  sandbox: Sandbox,
  manager: SandboxManager,
): SandboxSession {
  const files = createScopedFilesystem(sandbox)

  const commands: SandboxSessionCommands = {
    async run(cmd, options) {
      const cwd = options?.cwd ?? SANDBOX_WORKSPACE_ROOT
      if (options?.background) {
        const handle = await sandbox.commands.run(cmd, {
          background: true,
          cwd,
        })
        return { stdout: "", stderr: "", exitCode: 0, pid: handle.pid }
      }

      const result = await sandbox.commands.run(cmd, {
        cwd,
        timeoutMs: options?.timeoutMs,
      })
      return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode,
      }
    },
  }

  return {
    domain,
    sandboxId: sandbox.sandboxId,
    files,
    commands,
    raw: sandbox,

    getHost(port: number): string {
      return sandbox.getHost(port)
    },

    async pause(): Promise<void> {
      await manager.pause(domain.domain_id)
    },

    async kill(): Promise<void> {
      await manager.kill(domain.domain_id)
    },
  }
}
