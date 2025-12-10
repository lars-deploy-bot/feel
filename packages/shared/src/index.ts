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

export {
  COOKIE_NAMES,
  SESSION_MAX_AGE,
  FREE_CREDITS,
  ENV_VARS,
  TEST_CONFIG,
  WORKER_POOL,
  BRIDGE_STREAM_TYPES,
  BRIDGE_SYNTHETIC_MESSAGE_TYPES,
  BRIDGE_INTERRUPT_SOURCES,
  REFERRAL,
  LIMITS,
  WORKSPACE_STORAGE,
  PREVIEW_MESSAGES,
  FEATURE_FLAGS,
  createWorkspaceStorageValue,
  type BridgeStreamType,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
  type WorkspaceStorageRecentItem,
  type WorkspaceStorageState,
  type WorkspaceStorageValue,
} from "./constants.js"
export { generateInviteCode } from "./invite-code.js"
export {
  PATHS,
  DOMAINS,
  PORTS,
  TIMEOUTS,
  DEFAULTS,
  SECURITY,
  SUPERADMIN,
  BRIDGE_ENV,
  type BridgeEnv,
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
  // OAuth MCP providers (require authentication)
  OAUTH_MCP_PROVIDERS,
  getOAuthMcpProviderKeys,
  isValidOAuthMcpProviderKey,
  isOAuthMcpTool,
  getMcpToolFriendlyName,
  type OAuthMcpProviderConfig,
  type OAuthMcpProviderRegistry,
  type OAuthMcpProviderKey,
  type ProviderTokenMap,
  // Global MCP providers (always available, no auth required)
  GLOBAL_MCP_PROVIDERS,
  getGlobalMcpProviderKeys,
  getGlobalMcpToolNames,
  type GlobalMcpProviderConfig,
  type GlobalMcpProviderRegistry,
  type GlobalMcpProviderKey,
} from "./mcp-providers.js"
export {
  formatProviderName,
  type OAuthWarning,
  type OAuthWarningCategory,
  type OAuthWarningContent,
  type OAuthFetchResult,
} from "./oauth-warnings.js"
export {
  isPathWithinWorkspace,
  resolveAndValidatePath,
  type PathValidationResult,
} from "./path-security.js"
export {
  // SDK tool constants
  BRIDGE_ALLOWED_SDK_TOOLS,
  BRIDGE_ADMIN_ONLY_SDK_TOOLS,
  BRIDGE_ALWAYS_DISALLOWED_SDK_TOOLS,
  BRIDGE_PERMISSION_MODE,
  BRIDGE_SETTINGS_SOURCES,
  type BridgeAllowedSDKTool,
  type BridgeDisallowedSDKTool,
  type BridgeAdminOnlySDKTool,
  type BridgeAlwaysDisallowedSDKTool,
  // Helper functions
  getBridgeAllowedTools,
  getBridgeDisallowedTools,
  getBridgeMcpServers,
  createBridgeCanUseTool,
  getWorkspacePath,
  type BridgeMcpServerConfig,
} from "./bridge-tools.js"
export {
  // Claude models - SINGLE SOURCE OF TRUTH
  CLAUDE_MODELS,
  DEFAULT_CLAUDE_MODEL,
  isValidClaudeModel,
  getModelDisplayName,
  type ClaudeModel,
} from "./models.js"
export {
  // Output limiting utilities
  truncateOutput,
  DEFAULT_MAX_CHARS,
  DEFAULT_MAX_LINES,
  type TruncateOptions,
} from "./output-limits.js"
