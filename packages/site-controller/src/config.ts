import { resolve } from 'node:path'

/**
 * Path constants for site controller
 */
export const PATHS = {
  /** Root directory for webalive sites */
  WEBALIVE_ROOT: '/root/webalive',

  /** Secure site directory (systemd) */
  SITES_ROOT: '/srv/webalive/sites',

  /** Legacy site directory (PM2) */
  LEGACY_SITES_ROOT: '/root/webalive/sites',

  /** Template directory */
  TEMPLATE_PATH: '/root/webalive/claude-bridge/packages/template',

  /** Domain password registry */
  REGISTRY_PATH: '/var/lib/claude-bridge/domain-passwords.json',

  /** Server config */
  SERVER_CONFIG: '/var/lib/claude-bridge/server-config.json',

  /** Caddyfile location */
  CADDYFILE_PATH: '/root/webalive/claude-bridge/Caddyfile',

  /** Systemd service configs */
  SYSTEMD_ENV_DIR: '/etc/sites',

  /** Caddyfile lock */
  CADDY_LOCK: '/tmp/caddyfile.lock',
} as const

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Server IP for DNS validation */
  SERVER_IP: '138.201.56.93',

  /** Wildcard domain that skips DNS validation (subdomains of this domain skip validation) */
  WILDCARD_DOMAIN: 'alive.best',

  /** Port range for site assignments */
  PORT_RANGE: {
    MIN: 3333,
    MAX: 3999,
  },

  /** Service startup retry attempts */
  SERVICE_RETRIES: 3,

  /** Service startup wait time (ms) */
  SERVICE_WAIT_MS: 3000,

  /** Port check wait time (ms) */
  PORT_CHECK_WAIT_MS: 2000,

  /** Caddy reload wait time (ms) */
  CADDY_WAIT_MS: 2000,

  /** Flock timeout (seconds) */
  FLOCK_TIMEOUT: 30,
} as const

/**
 * Generate systemd service name from slug
 */
export function getServiceName(slug: string): string {
  return `site@${slug}.service`
}

/**
 * Generate site user from slug
 */
export function getSiteUser(slug: string): string {
  return `site-${slug}`
}

/**
 * Generate site home directory from domain
 */
export function getSiteHome(domain: string): string {
  return `${PATHS.SITES_ROOT}/${domain}`
}

/**
 * Generate env file path from slug
 */
export function getEnvFilePath(slug: string): string {
  return `${PATHS.SYSTEMD_ENV_DIR}/${slug}.env`
}
