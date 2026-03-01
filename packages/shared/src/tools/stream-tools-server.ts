/**
 * Stream Tools — Server-only helpers
 *
 * Functions that depend on server infrastructure config (filesystem paths,
 * superadmin workspace path). Separated from stream-tools.ts so client
 * code can import tool policies without pulling in node:fs / config.ts.
 */

import { PATHS, SUPERADMIN } from "../config.js"

/**
 * Get workspace path for a domain.
 * For the "alive" workspace, returns the platform root instead of a site directory.
 */
export function getWorkspacePath(domain: string): string {
  if (domain === SUPERADMIN.WORKSPACE_NAME) {
    return SUPERADMIN.WORKSPACE_PATH
  }
  return `${PATHS.SITES_ROOT}/${domain}/user`
}
