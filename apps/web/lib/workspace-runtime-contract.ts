import { existsSync, readFileSync } from "node:fs"
import { PATHS } from "@webalive/shared"

interface WorkspaceRuntimeContractInput {
  sitesRoot: string
  sitesRootExists: boolean
  sitesRootReadOnly: boolean | null
  streamEnv: string | undefined
  uid: number | null
}

function isLocalLikeStreamEnv(streamEnv: string | undefined): boolean {
  return streamEnv === "local" || streamEnv === "standalone"
}

export function getWorkspaceRuntimeContractViolation({
  sitesRoot,
  sitesRootExists,
  sitesRootReadOnly,
  streamEnv,
  uid,
}: WorkspaceRuntimeContractInput): string | null {
  if (!sitesRoot || !sitesRootExists) {
    return null
  }

  if (isLocalLikeStreamEnv(streamEnv)) {
    return null
  }

  if (uid === null) {
    return `Workspace runtime contract violated: ${sitesRoot} is available, but process.getuid() is unavailable.`
  }

  if (uid !== 0) {
    return (
      `Workspace runtime contract violated: ${sitesRoot} is mounted for systemd workspaces, ` +
      `but the app is running as uid=${uid}. This runtime must start as root so it can access ` +
      "site-owned workspace directories under the shared sites root."
    )
  }

  if (sitesRootReadOnly === true) {
    return (
      `Workspace runtime contract violated: ${sitesRoot} is mounted read-only. ` +
      "Systemd workspace operations require a writable shared sites root."
    )
  }

  return null
}

function decodeMountInfoPath(value: string): string {
  return value.replaceAll("\\040", " ").replaceAll("\\011", "\t").replaceAll("\\012", "\n").replaceAll("\\134", "\\")
}

export function getMountReadOnlyState(mountInfo: string, targetPath: string): boolean | null {
  const normalizedTargetPath = targetPath.trim()
  if (!normalizedTargetPath) {
    return null
  }

  let matchedMountPointLength = -1
  let matchedReadOnlyState: boolean | null = null

  for (const rawLine of mountInfo.split("\n")) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const separatorIndex = line.indexOf(" - ")
    if (separatorIndex === -1) {
      continue
    }

    const fields = line.slice(0, separatorIndex).split(" ")
    if (fields.length < 6) {
      continue
    }

    const mountPoint = decodeMountInfoPath(fields[4] ?? "")
    const mountOptions = fields[5] ?? ""
    const targetMatches = normalizedTargetPath === mountPoint || normalizedTargetPath.startsWith(`${mountPoint}/`)

    if (!targetMatches || mountPoint.length <= matchedMountPointLength) {
      continue
    }

    const options = mountOptions.split(",")
    if (options.includes("ro")) {
      matchedMountPointLength = mountPoint.length
      matchedReadOnlyState = true
      continue
    }

    if (options.includes("rw")) {
      matchedMountPointLength = mountPoint.length
      matchedReadOnlyState = false
    }
  }

  return matchedReadOnlyState
}

export function assertWorkspaceRuntimeContract(): void {
  const sitesRoot = PATHS.SITES_ROOT
  const sitesRootExists = sitesRoot.length > 0 && existsSync(sitesRoot)
  const uid = typeof process.getuid === "function" ? process.getuid() : null
  const sitesRootReadOnly =
    sitesRootExists && process.platform === "linux"
      ? getMountReadOnlyState(readFileSync("/proc/self/mountinfo", "utf8"), sitesRoot)
      : null

  const violation = getWorkspaceRuntimeContractViolation({
    sitesRoot,
    sitesRootExists,
    sitesRootReadOnly,
    streamEnv: process.env.STREAM_ENV,
    uid,
  })

  if (violation) {
    throw new Error(violation)
  }
}
