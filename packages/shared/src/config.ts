/**
 * ============================================================================
 * INFRASTRUCTURE CONFIGURATION - SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * This file contains ALL hardcoded infrastructure constants used throughout
 * the WebAlive platform. Always import from this file - never hardcode values.
 *
 * IMPORTANT: This package is browser-safe and contains NO Node.js dependencies.
 * It can be safely imported in both client and server code.
 *
 * Organization:
 * - PATHS: Filesystem paths
 * - DOMAINS: Domain names and URLs
 * - PORTS: Port numbers and ranges
 * - TIMEOUTS: Timing constants
 * - DEFAULTS: Default values and configuration
 * - SECURITY: Security-related constants
 */

/**
 * Path constants
 */
export const PATHS = {
  /** Root directory for webalive project */
  WEBALIVE_ROOT: "/root/webalive",

  /** Claude Bridge root directory */
  BRIDGE_ROOT: "/root/webalive/claude-bridge",

  /** Secure site directory (systemd) */
  SITES_ROOT: "/srv/webalive/sites",

  /** Legacy site directory (PM2) - should migrate to SITES_ROOT */
  LEGACY_SITES_ROOT: "/root/webalive/sites",

  /** Template directory for new sites */
  TEMPLATE_PATH: "/root/webalive/claude-bridge/packages/template",

  /** Domain password registry */
  REGISTRY_PATH: "/var/lib/claude-bridge/domain-passwords.json",

  /** Server config (contains server IP, etc.) */
  SERVER_CONFIG: "/var/lib/claude-bridge/server-config.json",

  /** Caddyfile location for reverse proxy configuration */
  CADDYFILE_PATH: "/root/webalive/claude-bridge/Caddyfile",

  /** Systemd service environment files */
  SYSTEMD_ENV_DIR: "/etc/sites",

  /** Caddyfile lock for concurrent write protection */
  CADDY_LOCK: "/tmp/caddyfile.lock",

  /** Image storage base path */
  IMAGES_STORAGE: "/srv/webalive/storage",

  /** Site backup repository */
  BACKUP_REPO: "/srv/webalive",
} as const

/**
 * Domain and URL constants
 */
export const DOMAINS = {
  /** Wildcard domain for automatic subdomain deployment */
  WILDCARD: "alive.best",

  /** Main platform domain */
  MAIN: "goalive.nl",

  /** Production bridge URL */
  BRIDGE_PROD: "https://terminal.goalive.nl",

  /** Development bridge URL */
  BRIDGE_DEV: "https://dev.terminal.goalive.nl",

  /** Staging bridge URL (same host as dev, different port) */
  BRIDGE_STAGING: "https://dev.terminal.goalive.nl",

  /** Preview subdomain base */
  PREVIEW_BASE: "preview.terminal.goalive.nl",

  /** Authentication forward endpoint for previews */
  PREVIEW_AUTH: "https://dev.terminal.goalive.nl/api/auth/preview-guard",
} as const

/**
 * Port configuration
 */
export const PORTS = {
  /** Port range for site deployments */
  SITE_RANGE: {
    MIN: 3333,
    MAX: 3999,
  },

  /** Local development server */
  LOCAL_DEV: 3000,

  /** Development environment (systemd) */
  DEV: 8997,

  /** Staging environment (systemd) */
  STAGING: 8998,
} as const

/**
 * Timeout and timing constants (all in milliseconds unless specified)
 */
export const TIMEOUTS = {
  /** Service startup wait time */
  SERVICE_WAIT: 3000,

  /** Port availability check wait time */
  PORT_CHECK: 2000,

  /** Caddy reload wait time */
  CADDY_RELOAD: 2000,

  /** HTTP request timeout for status checks */
  HTTP_REQUEST: 3000,

  /** Test timeouts */
  TEST: {
    SHORT: 1000,
    MEDIUM: 3000,
    LONG: 10000,
  },

  /** Flock timeout (in seconds, not milliseconds) */
  FLOCK: 30,
} as const

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Server IP for DNS validation */
  SERVER_IP: "138.201.56.93",

  /** Wildcard domain (alias for DOMAINS.WILDCARD for backward compatibility) */
  WILDCARD_DOMAIN: "alive.best",

  /** Port range (alias for PORTS.SITE_RANGE for backward compatibility) */
  PORT_RANGE: {
    MIN: 3333,
    MAX: 3999,
  },

  /** Service startup retry attempts */
  SERVICE_RETRIES: 3,

  /** Service startup wait time (alias for TIMEOUTS.SERVICE_WAIT) */
  SERVICE_WAIT_MS: 3000,

  /** Port check wait time (alias for TIMEOUTS.PORT_CHECK) */
  PORT_CHECK_WAIT_MS: 2000,

  /** Caddy reload wait time (alias for TIMEOUTS.CADDY_RELOAD) */
  CADDY_WAIT_MS: 2000,

  /** Flock timeout in seconds (alias for TIMEOUTS.FLOCK) */
  FLOCK_TIMEOUT: 30,

  /** Default password for new deployments (development only) */
  PASSWORD: "supersecret",

  /** Default Claude model */
  CLAUDE_MODEL: "claude-sonnet-4-5-20250929",

  /** Default Claude max turns */
  CLAUDE_MAX_TURNS: 25,

  /** Default fallback origin for CORS */
  FALLBACK_ORIGIN: "https://terminal.goalive.nl",
} as const

/**
 * Security constants
 */
export const SECURITY = {
  /** Allowed workspace base directories */
  ALLOWED_WORKSPACE_BASES: ["/srv/webalive/sites", "/root/webalive/sites"] as readonly string[],

  /** CORS allowed origins */
  CORS_ORIGINS: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://terminal.goalive.nl",
    "https://dev.terminal.goalive.nl",
  ] as readonly string[],

  /** Environment-specific test credentials */
  LOCAL_TEST: {
    EMAIL: "test@bridge.local",
    PASSWORD: "test",
  },
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
