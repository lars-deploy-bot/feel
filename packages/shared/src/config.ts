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

  /** Site directory (systemd-managed) */
  SITES_ROOT: "/srv/webalive/sites",

  /** Template directory for new sites */
  TEMPLATE_PATH: "/root/webalive/claude-bridge/templates/site-template",

  /** Site controller deployment scripts directory */
  SCRIPTS_DIR: "/root/webalive/claude-bridge/packages/site-controller/scripts",

  /** Domain password registry */
  REGISTRY_PATH: "/var/lib/claude-bridge/domain-passwords.json",

  /** Server config (contains server IP, etc.) */
  SERVER_CONFIG: "/var/lib/claude-bridge/server-config.json",

  /** Caddyfile location for reverse proxy configuration */
  CADDYFILE_PATH: "/root/webalive/claude-bridge/ops/caddy/Caddyfile",

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

  /** Main domain suffix for CORS/origin checks */
  MAIN_SUFFIX: ".goalive.nl",

  /** Production bridge URL */
  BRIDGE_PROD: "https://terminal.goalive.nl",

  /** Production bridge hostname */
  BRIDGE_PROD_HOST: "terminal.goalive.nl",

  /** Development bridge URL */
  BRIDGE_DEV: "https://dev.terminal.goalive.nl",

  /** Development bridge hostname */
  BRIDGE_DEV_HOST: "dev.terminal.goalive.nl",

  /** Staging bridge URL */
  BRIDGE_STAGING: "https://staging.terminal.goalive.nl",

  /** Staging bridge hostname */
  BRIDGE_STAGING_HOST: "staging.terminal.goalive.nl",

  /** Staging domain suffix */
  STAGING_SUFFIX: ".staging.goalive.nl",

  /** Dev domain suffix */
  DEV_SUFFIX: ".dev.goalive.nl",

  /** Preview subdomain base (e.g., windowsxp-alive-best.preview.terminal.goalive.nl) */
  PREVIEW_BASE: "preview.terminal.goalive.nl",

  /** Authentication forward endpoint for previews */
  PREVIEW_AUTH: "https://dev.terminal.goalive.nl/api/auth/preview-guard",

  /** Cookie domain for cross-subdomain sharing (leading dot allows *.terminal.goalive.nl) */
  COOKIE_DOMAIN: ".terminal.goalive.nl",
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

  /** Default Claude model - uses short name from models.ts */
  CLAUDE_MODEL: "claude-sonnet-4-5" as const,

  /** Default Claude max turns */
  CLAUDE_MAX_TURNS: 50,

  /** Default fallback origin for CORS */
  FALLBACK_ORIGIN: "https://terminal.goalive.nl",

  /** Template ID prefix - all template IDs must start with this */
  TEMPLATE_ID_PREFIX: "tmpl_",
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
    "https://staging.terminal.goalive.nl",
    "https://app.alive.best",
  ] as readonly string[],

  /** Environment-specific test credentials */
  LOCAL_TEST: {
    EMAIL: "test@bridge.local",
    PASSWORD: "test",
    /** Session cookie value for local test mode (bypasses JWT verification) */
    SESSION_VALUE: "test-user",
  },
} as const

/**
 * Bridge environment values
 * Must match the zod enum in @webalive/env schema
 */
export const BRIDGE_ENV = {
  LOCAL: "local",
  DEV: "dev",
  STAGING: "staging",
  PRODUCTION: "production",
} as const

export type BridgeEnv = (typeof BRIDGE_ENV)[keyof typeof BRIDGE_ENV]

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
