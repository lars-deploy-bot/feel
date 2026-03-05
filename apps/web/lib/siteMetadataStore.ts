import path from "node:path"
import { parseSiteMetadata, SITE_METADATA_FILENAME, type SiteMetadata } from "@webalive/shared"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { buildSubdomain, WORKSPACE_BASE } from "./config"
import { ensureDirectory, readJsonFile, writeJsonFile } from "./utils/fs-helpers"

// Re-export schema/type from the package so existing consumers don't break.
export { parseSiteMetadata, SITE_METADATA_FILENAME, type SiteMetadata, SiteMetadataSchema } from "@webalive/shared"

// --- Store ---

function getMetadataPath(workspace: string): string {
  return path.join(workspace, SITE_METADATA_FILENAME)
}

function assertWithinWorkspace(resolvedPath: string): void {
  if (!isPathWithinWorkspace(resolvedPath, WORKSPACE_BASE)) {
    throw new Error(`Path traversal blocked: ${resolvedPath} is outside workspace root`)
  }
}

export const siteMetadataStore = {
  async getSite(slug: string): Promise<SiteMetadata | null> {
    const domain = buildSubdomain(slug)
    const workspacePath = path.resolve(WORKSPACE_BASE, domain)
    assertWithinWorkspace(workspacePath)
    const metadataPath = getMetadataPath(workspacePath)

    const raw = await readJsonFile<unknown>(metadataPath)
    if (raw === null) return null

    return parseSiteMetadata(raw, slug)
  },

  async setSite(slug: string, metadata: SiteMetadata): Promise<void> {
    const validated = parseSiteMetadata(metadata, slug)
    const workspacePath = path.resolve(WORKSPACE_BASE, validated.domain)
    assertWithinWorkspace(workspacePath)
    const metadataPath = getMetadataPath(workspacePath)

    await ensureDirectory(path.dirname(metadataPath))
    await writeJsonFile(metadataPath, validated)
  },

  async exists(slug: string): Promise<boolean> {
    const domain = buildSubdomain(slug)
    const workspacePath = path.resolve(WORKSPACE_BASE, domain)
    assertWithinWorkspace(workspacePath)
    const metadataPath = getMetadataPath(workspacePath)
    const raw = await readJsonFile<unknown>(metadataPath)
    return raw !== null
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
