import { E2B_DEFAULT_TEMPLATE, E2B_TEMPLATES, type E2bTemplate } from "@webalive/sandbox"
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
 * Route E2E tenants to a minimal sandbox template for faster/stabler lifecycle checks.
 */
export function resolveSandboxTemplate(hostname: string): E2bTemplate {
  if (isE2eWorkspaceHostname(hostname)) {
    return E2B_TEMPLATES.ALIVE_E2E_MINIMAL
  }
  return E2B_DEFAULT_TEMPLATE
}
