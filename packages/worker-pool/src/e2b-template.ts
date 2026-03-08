import { E2B_DEFAULT_TEMPLATE, type E2bTemplate } from "@webalive/sandbox"
import { TEST_CONFIG } from "@webalive/shared"

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const E2E_WORKSPACE_HOSTNAME = new RegExp(
  `^${escapeRegex(TEST_CONFIG.WORKSPACE_PREFIX)}\\d+\\.${escapeRegex(TEST_CONFIG.EMAIL_DOMAIN)}$`,
)

/**
 * E2E worker workspaces follow a deterministic naming convention:
 * `${TEST_CONFIG.WORKSPACE_PREFIX}{index}.${TEST_CONFIG.EMAIL_DOMAIN}`.
 */
export function isE2eWorkspaceHostname(hostname: string): boolean {
  return E2E_WORKSPACE_HOSTNAME.test(hostname)
}

/**
 * Route hostname to the appropriate sandbox template.
 *
 * Note: E2E workspaces previously routed to ALIVE_E2E_MINIMAL, but that
 * template was never created. All workspaces now use the default template.
 */
export function resolveSandboxTemplate(_hostname: string): E2bTemplate {
  return E2B_DEFAULT_TEMPLATE
}
