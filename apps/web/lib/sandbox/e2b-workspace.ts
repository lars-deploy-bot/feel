import { existsSync, mkdirSync } from "node:fs"
import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ExecutionMode } from "@webalive/database"
import { env } from "@webalive/env/server"
import { PATHS } from "@webalive/shared"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import lockfile from "proper-lockfile"
import { ensureWorkspaceSchema } from "@/features/workspace/lib/ensure-workspace-schema"

const COPY_EXCLUDES = new Set(["node_modules", ".bun", ".git", "template"])

function requireE2bScratchRoot(): string {
  if (!PATHS.E2B_SCRATCH_ROOT) {
    throw new Error("E2B_SCRATCH_ROOT is not configured in server-config.json (paths.e2bScratchRoot)")
  }
  return PATHS.E2B_SCRATCH_ROOT
}

/**
 * Per-domain file lock to prevent concurrent workspace operations (rm/mkdir/cp)
 * from corrupting each other. Uses proper-lockfile on a `.lock` file per domain
 * inside the E2B scratch root.
 */
async function withDomainLock<T>(domain: string, fn: () => Promise<T>): Promise<T> {
  const scratchRoot = requireE2bScratchRoot()
  if (!existsSync(scratchRoot)) {
    mkdirSync(scratchRoot, { recursive: true })
  }

  const lockTarget = path.join(scratchRoot, `${domain}.lock`)
  if (!existsSync(lockTarget)) {
    await writeFile(lockTarget, "", { flag: "wx" }).catch(() => {
      /* already exists — fine */
    })
  }

  const release = await lockfile.lock(lockTarget, {
    retries: { retries: 5, minTimeout: 200, maxTimeout: 2000 },
    stale: 30_000,
  })

  try {
    return await fn()
  } finally {
    await release()
  }
}

export function getNewSiteExecutionMode(): ExecutionMode {
  return env.NEW_SITE_EXECUTION_MODE
}

export function getE2bScratchSiteRoot(domain: string): string {
  const scratchRoot = requireE2bScratchRoot()
  const resolved = path.resolve(scratchRoot, domain)
  if (!isPathWithinWorkspace(resolved, scratchRoot)) {
    throw new Error(`Scratch workspace escaped E2B root: ${domain}`)
  }
  return resolved
}

export function getE2bScratchUserDir(domain: string): string {
  return path.join(getE2bScratchSiteRoot(domain), "user")
}

export function isE2bScratchPath(candidatePath: string): boolean {
  if (!PATHS.E2B_SCRATCH_ROOT) {
    return false
  }

  return isPathWithinWorkspace(path.resolve(candidatePath), PATHS.E2B_SCRATCH_ROOT)
}

export async function resetE2bScratchUserWorkspace(domain: string, sourceUserDir?: string): Promise<string> {
  return withDomainLock(domain, async () => {
    const siteRoot = getE2bScratchSiteRoot(domain)
    const userDir = getE2bScratchUserDir(domain)

    await rm(siteRoot, { recursive: true, force: true })
    await mkdir(PATHS.E2B_SCRATCH_ROOT, { recursive: true })

    if (sourceUserDir) {
      await cp(sourceUserDir, userDir, {
        recursive: true,
        force: true,
        filter: source => {
          const name = path.basename(source)
          return !COPY_EXCLUDES.has(name)
        },
      })
    } else {
      await mkdir(userDir, { recursive: true })
    }

    await ensureWorkspaceSchema(userDir)
    return userDir
  })
}

export async function prepareE2bScratchWorkspace(domain: string, templatePath: string): Promise<string> {
  return withDomainLock(domain, async () => {
    const siteRoot = getE2bScratchSiteRoot(domain)
    const userDir = getE2bScratchUserDir(domain)

    await rm(siteRoot, { recursive: true, force: true })
    await mkdir(PATHS.E2B_SCRATCH_ROOT, { recursive: true })

    await cp(templatePath, siteRoot, {
      recursive: true,
      force: true,
      filter: source => {
        const name = path.basename(source)
        return !COPY_EXCLUDES.has(name)
      },
    })

    await mkdir(userDir, { recursive: true })
    await ensureWorkspaceSchema(userDir)
    return userDir
  })
}
