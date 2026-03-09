import path from "node:path"
import { PATHS, parseSiteMetadata, SITE_METADATA_FILENAME, type SiteMetadata } from "@webalive/shared"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { buildSubdomain, WORKSPACE_BASE } from "./config"
import { getSiteWorkspaceCandidates, getSiteWorkspaceRoot } from "./site-workspace-registry"
import { ensureDirectory, readJsonFile, writeJsonFile } from "./utils/fs-helpers"

// Re-export schema/type from the package so existing consumers don't break.
export { parseSiteMetadata, SITE_METADATA_FILENAME, type SiteMetadata, SiteMetadataSchema } from "@webalive/shared"

// --- Store ---

function getMetadataPath(workspace: string): string {
  return path.join(workspace, SITE_METADATA_FILENAME)
}

function assertWithinWorkspace(resolvedPath: string): void {
  const withinSystemdRoot = WORKSPACE_BASE.length > 0 && isPathWithinWorkspace(resolvedPath, WORKSPACE_BASE)
  const withinE2bScratchRoot =
    PATHS.E2B_SCRATCH_ROOT.length > 0 && isPathWithinWorkspace(resolvedPath, PATHS.E2B_SCRATCH_ROOT)

  if (!withinSystemdRoot && !withinE2bScratchRoot) {
    throw new Error(`Path traversal blocked: ${resolvedPath} is outside workspace root`)
  }
}

interface SiteMetadataSetOptions {
  workspaceRoot?: string
}

export const siteMetadataStore = {
  async getSite(slug: string): Promise<SiteMetadata | null> {
    const domain = buildSubdomain(slug)
    for (const workspacePath of getSiteWorkspaceCandidates(domain)) {
      assertWithinWorkspace(workspacePath)
      const metadataPath = getMetadataPath(workspacePath)
      const raw = await readJsonFile<unknown>(metadataPath)
      if (raw !== null) {
        return parseSiteMetadata(raw, slug)
      }
    }

    return null
  },

  async setSite(slug: string, metadata: SiteMetadata, options?: SiteMetadataSetOptions): Promise<void> {
    const validated = parseSiteMetadata(metadata, slug)
    const workspacePath = options?.workspaceRoot
      ? path.resolve(options.workspaceRoot)
      : getSiteWorkspaceRoot(validated.domain, "systemd")
    assertWithinWorkspace(workspacePath)
    const metadataPath = getMetadataPath(workspacePath)

    await ensureDirectory(path.dirname(metadataPath))
    await writeJsonFile(metadataPath, validated)
  },

  async exists(slug: string): Promise<boolean> {
    const domain = buildSubdomain(slug)
    for (const workspacePath of getSiteWorkspaceCandidates(domain)) {
      assertWithinWorkspace(workspacePath)
      const metadataPath = getMetadataPath(workspacePath)
      const raw = await readJsonFile<unknown>(metadataPath)
      if (raw !== null) {
        return true
      }
    }

    return false
  },
}

/**
 * Read metadata from a pre-resolved workspace path.
 * Caller is responsible for path validation — this function does NOT
 * enforce workspace-root containment (workspace paths come from the
 * server, not from user input).
 */
export async function getSiteMetadataByWorkspace(workspace: string): Promise<SiteMetadata | null> {
  const metadataPath = getMetadataPath(path.resolve(workspace))
  const raw = await readJsonFile<unknown>(metadataPath)
  if (raw === null) return null
  return parseSiteMetadata(raw, workspace)
}
