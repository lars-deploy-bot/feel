import { existsSync } from "node:fs"
import { PATHS } from "@webalive/shared"

interface WorkspaceRuntimeContractInput {
  sitesRoot: string
  sitesRootExists: boolean
  streamEnv: string | undefined
  uid: number | null
}

function isLocalLikeStreamEnv(streamEnv: string | undefined): boolean {
  return streamEnv === "local" || streamEnv === "standalone"
}

export function getWorkspaceRuntimeContractViolation({
  sitesRoot,
  sitesRootExists,
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

  return null
}

export function assertWorkspaceRuntimeContract(): void {
  const sitesRoot = PATHS.SITES_ROOT
  const sitesRootExists = sitesRoot.length > 0 && existsSync(sitesRoot)
  const uid = typeof process.getuid === "function" ? process.getuid() : null

  const violation = getWorkspaceRuntimeContractViolation({
    sitesRoot,
    sitesRootExists,
    streamEnv: process.env.STREAM_ENV,
    uid,
  })

  if (violation) {
    throw new Error(violation)
  }
}
