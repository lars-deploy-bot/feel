import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { PATHS, TEST_CONFIG } from "@webalive/shared"
import { domainToSlug } from "@/features/manager/lib/domain-utils"

const MAX_LINUX_USERNAME_LENGTH = 32
const HOST_NAMESPACE_ARGS = ["--target", "1", "--mount", "--"]
const HOST_USER_DATABASE_FILES = ["/etc/passwd", "/etc/group", "/etc/shadow", "/etc/gshadow"]

interface PosixIds {
  uid: number
  gid: number
}

function parseNumericId(value: string, source: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric ID from ${source}: "${value}"`)
  }
  return parsed
}

function isRunningInDocker(): boolean {
  return existsSync("/.dockerenv")
}

async function execFileAsync(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }

      resolve({ stdout, stderr })
    })
  })
}

async function execHostFile(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  if (isRunningInDocker()) {
    return execFileAsync("nsenter", [...HOST_NAMESPACE_ARGS, command, ...args])
  }
  return execFileAsync(command, args)
}

async function syncDockerUserDatabase(): Promise<void> {
  if (!isRunningInDocker()) {
    return
  }

  for (const filePath of HOST_USER_DATABASE_FILES) {
    const { stdout } = await execHostFile("cat", [filePath])
    await writeFile(filePath, stdout, "utf8")
  }
}

export async function readPosixIds(username: string): Promise<PosixIds | null> {
  try {
    const { stdout: uidStdout } = await execHostFile("id", ["-u", username])
    const { stdout: gidStdout } = await execHostFile("id", ["-g", username])

    return {
      uid: parseNumericId(uidStdout, `id -u ${username}`),
      gid: parseNumericId(gidStdout, `id -g ${username}`),
    }
  } catch (_error) {
    return null
  }
}

export async function ensureSystemUser(username: string): Promise<PosixIds> {
  await syncDockerUserDatabase()

  const existing = await readPosixIds(username)
  if (existing) {
    return existing
  }

  await execHostFile("useradd", [
    "--system",
    "--user-group",
    "--no-create-home",
    "--shell",
    "/usr/sbin/nologin",
    username,
  ])

  await syncDockerUserDatabase()

  const created = await readPosixIds(username)
  if (!created) {
    throw new Error(`Failed to resolve uid/gid for created user: ${username}`)
  }

  return created
}

export async function ensureWorkspaceFilesystem(workspace: string): Promise<void> {
  const slug = domainToSlug(workspace)
  const linuxUser = `site-${slug}`

  if (linuxUser.length > MAX_LINUX_USERNAME_LENGTH) {
    throw new Error(`Workspace slug too long for linux user: ${linuxUser}`)
  }

  const isTestWorkspace = workspace.endsWith(`.${TEST_CONFIG.EMAIL_DOMAIN}`) || workspace.endsWith(".alive.test")
  if (!isTestWorkspace) {
    console.warn("[Bootstrap] Skipping filesystem wipe for non-test workspace:", workspace)
    return
  }

  const resolvedSitesRoot = path.resolve(PATHS.SITES_ROOT)
  const resolvedWorkspaceRoot = path.resolve(path.join(PATHS.SITES_ROOT, workspace))
  const relativeWorkspacePath = path.relative(resolvedSitesRoot, resolvedWorkspaceRoot)

  if (
    relativeWorkspacePath.length === 0 ||
    relativeWorkspacePath.startsWith("..") ||
    path.isAbsolute(relativeWorkspacePath)
  ) {
    throw new Error(`Workspace path escapes SITES_ROOT: ${workspace}`)
  }

  const workspaceUserDir = path.join(resolvedWorkspaceRoot, "user")

  await rm(workspaceUserDir, { recursive: true, force: true })
  await mkdir(workspaceUserDir, { recursive: true, mode: 0o750 })
  await writeFile(
    path.join(workspaceUserDir, "README.md"),
    "# E2E Workspace\n\nThis workspace is provisioned for live staging E2E tests.\n",
    "utf8",
  )

  const currentUid = typeof process.getuid === "function" ? process.getuid() : null
  const currentGid = typeof process.getgid === "function" ? process.getgid() : null

  if (currentUid === null || currentGid === null) {
    throw new Error("Current process uid/gid is unavailable")
  }

  if (currentUid === 0) {
    const { uid, gid } = await ensureSystemUser(linuxUser)
    await execHostFile("chown", ["-R", `${uid}:${gid}`, resolvedWorkspaceRoot])
    return
  }

  await execHostFile("chown", ["-R", `${currentUid}:${currentGid}`, resolvedWorkspaceRoot]).catch(() => {
    // If chown is not permitted, the directory is already process-owned in non-root mode.
  })
}
