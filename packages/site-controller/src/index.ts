/**
 * Site Controller - Shell-Operator Pattern for Website Deployment
 *
 * This package implements atomic, idempotent deployment of websites using:
 * - Node.js (Brain): Auth, DB, State, Error Handling, Orchestration
 * - Bash (Hands): Filesystem, Permissions, Users, systemd
 *
 * @packageDocumentation
 */

export { SiteOrchestrator } from './orchestrator.js'
export type { DeployConfig, DeployResult, DnsValidationResult, PortAssignment } from './types.js'
export { PATHS, DEFAULTS } from './config.js'

// Re-export individual executors for advanced usage
export { validateDns } from './executors/dns.js'
export { assignPort } from './executors/port.js'
export { ensureUser } from './executors/system.js'
export { setupFilesystem } from './executors/filesystem.js'
export { buildSite } from './executors/build.js'
export { startService } from './executors/service.js'

// Caddy operations - ALL Caddy functionality centralized here
export {
  configureCaddy,
  teardown,
  reloadCaddy,
  getCaddyStatus,
  validateCaddyConfig,
  checkDomainInCaddy,
} from './executors/caddy.js'

// Caddy types
export type {
  ConfigureCaddyParams,
  TeardownParams,
  CaddyStatus,
  CaddyValidation,
} from './executors/caddy.js'

// Backup operations
export { backupWebsites } from './backup.js'
export { DeploymentError } from './errors.js'
