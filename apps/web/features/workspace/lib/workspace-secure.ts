import * as crypto from "node:crypto"
import * as fs from "node:fs"
import { chown, mkdir } from "node:fs/promises"
import * as path from "node:path"

export interface Workspace {
  root: string
  uid: number
  gid: number
  tenantId: string
}

/**
 * Atomic write helper with proper ownership and durability
 * Writes are performed by the current process, then ownership is set to the workspace owner before atomic rename.
 */
export function writeAsWorkspaceOwner(
  filePath: string,
  content: Buffer | string,
  workspace: { uid: number; gid: number },
) {
  const dir = path.dirname(filePath)
  const tmp = path.join(dir, `.tmp-${crypto.randomUUID()}`)

  // Create temp exclusively; don't follow symlinks on the temp name
  const fd = fs.openSync(tmp, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o644)
  try {
    if (typeof content === "string") content = Buffer.from(content)
    fs.writeFileSync(fd, content)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }

  // Ensure ownership is correct *before* the rename; ownership persists across rename
  fs.chownSync(tmp, workspace.uid, workspace.gid)

  // Atomic replace
  fs.renameSync(tmp, filePath)

  // Durability: fsync the containing directory so the rename is persisted
  const dfd = fs.openSync(dir, fs.constants.O_RDONLY)
  try {
    fs.fsyncSync(dfd)
  } finally {
    fs.closeSync(dfd)
  }
}

/**
 * Containment guard for file operations
 * Must be called before any file operation to ensure path is within workspace
 */
export function ensurePathWithinWorkspace(filePath: string, workspaceRoot: string): void {
  const norm = path.normalize(filePath)
  if (!norm.startsWith(workspaceRoot + path.sep)) {
    throw new Error(`Path outside workspace: ${norm}`)
  }
}

/**
 * Ensure a directory tree exists within a workspace and matches workspace ownership.
 * Used before atomic writes so newly-created parent directories do not end up root-owned.
 */
export async function ensureDirectoryAsWorkspaceOwner(
  directoryPath: string,
  workspaceRoot: string,
  workspace: { uid: number; gid: number },
): Promise<void> {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot)
  const resolvedDirectoryPath = path.resolve(directoryPath)

  ensurePathWithinWorkspace(resolvedDirectoryPath, resolvedWorkspaceRoot)

  const relativePath = path.relative(resolvedWorkspaceRoot, resolvedDirectoryPath)
  if (relativePath === "" || relativePath === ".") {
    return
  }

  let currentPath = resolvedWorkspaceRoot
  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment)
    await mkdir(currentPath, { recursive: true })
    await chown(currentPath, workspace.uid, workspace.gid)
  }
}
