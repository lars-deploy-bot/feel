/**
 * Site metadata storage
 * Stores site context (slug, ideas, workspace) in a JSON file within the workspace
 * File-based approach: zero dependencies, scales to 100k+ sites
 */

import { promises as fs } from "node:fs"
import path from "node:path"

export interface SiteMetadata {
  slug: string
  domain: string
  workspace: string
  siteIdeas: string
  createdAt: number
  port?: number
}

export interface SiteMetadataStore {
  getSite(slug: string): Promise<SiteMetadata | null>
  setSite(slug: string, metadata: SiteMetadata): Promise<void>
  exists(slug: string): Promise<boolean>
}

// Metadata filename (hidden file)
const METADATA_FILENAME = ".site-metadata.json"

// Get metadata path for a given workspace
function getMetadataPath(workspace: string): string {
  return path.join(workspace, METADATA_FILENAME)
}

// Get wildcard TLD from environment
function getWildcardTld(): string {
  return process.env.WILDCARD_TLD || "alive.best"
}

// File-based implementation
export const siteMetadataStore: SiteMetadataStore = {
  async getSite(slug: string): Promise<SiteMetadata | null> {
    try {
      // Construct path: workspace is /srv/webalive/sites/{slug}.alive.best/user
      const tld = getWildcardTld()
      const workspacePath = `/srv/webalive/sites/${slug}.${tld}/user`
      const metadataPath = getMetadataPath(workspacePath)

      const content = await fs.readFile(metadataPath, "utf-8")
      const metadata = JSON.parse(content) as SiteMetadata

      // Validate structure
      if (!metadata.slug || !metadata.domain || !metadata.workspace || !metadata.siteIdeas) {
        console.error(`[Metadata] Invalid metadata structure for slug: ${slug}`)
        return null
      }

      return metadata
    } catch (error) {
      // File doesn't exist or is unreadable - that's fine, just return null
      if (error instanceof Error && error.message.includes("ENOENT")) {
        return null
      }
      console.error(`[Metadata] Failed to read metadata for slug ${slug}:`, error)
      return null
    }
  },

  async setSite(slug: string, metadata: SiteMetadata): Promise<void> {
    try {
      const workspacePath = metadata.workspace
      const metadataPath = getMetadataPath(workspacePath)

      // Ensure directory exists (should already exist from deploy script)
      const dir = path.dirname(metadataPath)
      try {
        await fs.mkdir(dir, { recursive: true })
      } catch (mkdirError) {
        // Directory might already exist, that's fine
        if (
          !(mkdirError instanceof Error) ||
          !mkdirError.message.includes("EEXIST")
        ) {
          throw mkdirError
        }
      }

      // Write metadata with pretty formatting
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8")
      console.log(`[Metadata] Saved metadata for slug: ${slug}`)
    } catch (error) {
      console.error(`[Metadata] Failed to save metadata for slug ${slug}:`, error)
      throw new Error(`Failed to save site metadata: ${error instanceof Error ? error.message : String(error)}`)
    }
  },

  async exists(slug: string): Promise<boolean> {
    const site = await this.getSite(slug)
    return site !== null
  },
}

// Alternative implementation that reads from explicit workspace path
// Useful when we have the workspace path but not the slug
export async function getSiteMetadataByWorkspace(workspace: string): Promise<SiteMetadata | null> {
  try {
    const metadataPath = getMetadataPath(workspace)
    const content = await fs.readFile(metadataPath, "utf-8")
    return JSON.parse(content) as SiteMetadata
  } catch {
    return null
  }
}
