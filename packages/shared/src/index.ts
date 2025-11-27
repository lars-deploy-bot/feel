/**
 * @webalive/shared
 *
 * Shared constants and types used across all packages in the monorepo.
 *
 * @example
 * ```typescript
 * import { COOKIE_NAMES, ENV_VARS, PATHS, DOMAINS } from "@webalive/shared"
 *
 * const sessionCookieName = COOKIE_NAMES.SESSION // "auth_session"
 * const envVarName = ENV_VARS.BRIDGE_SESSION_COOKIE // "BRIDGE_SESSION_COOKIE"
 * const sitesRoot = PATHS.SITES_ROOT // "/srv/webalive/sites"
 * ```
 */

export { COOKIE_NAMES, SESSION_MAX_AGE, ENV_VARS, TEST_CONFIG } from "./constants.js"
export {
  PATHS,
  DOMAINS,
  PORTS,
  TIMEOUTS,
  DEFAULTS,
  SECURITY,
  getServiceName,
  getSiteUser,
  getSiteHome,
  getEnvFilePath,
} from "./config.js"
export {
  environments,
  getEnvironment,
  getAllEnvironments,
  getEnvironmentByPort,
  getEnvironmentByProcessName,
  getEnvironmentByDomain,
  type Environment,
  type EnvironmentKey,
} from "./environments.js"
export {
  OAUTH_MCP_PROVIDERS,
  getOAuthMcpProviderKeys,
  isValidOAuthMcpProviderKey,
  isOAuthMcpTool,
  type OAuthMcpProviderConfig,
  type OAuthMcpProviderRegistry,
  type OAuthMcpProviderKey,
  type ProviderTokenMap,
} from "./mcp-providers.js"
export {
  formatProviderName,
  type OAuthWarning,
  type OAuthWarningCategory,
  type OAuthWarningContent,
  type OAuthFetchResult,
} from "./oauth-warnings.js"
