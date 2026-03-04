import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { SITE_METADATA_FILENAME } from "@webalive/shared"

/**
 * Resolve the path to .site-metadata.json for a workspace.
 *
 * Checks the workspace root first, then its parent — because callers
 * typically pass `<site>/user` as workspaceRoot while metadata lives
 * at `<site>/.site-metadata.json`.
 */
export function resolveMetadataPath(workspaceRoot: string): string | null {
  const direct = resolve(workspaceRoot, SITE_METADATA_FILENAME)
  if (existsSync(direct)) return direct

  const parent = resolve(workspaceRoot, "..", SITE_METADATA_FILENAME)
  if (existsSync(parent)) return parent

  return null
}
