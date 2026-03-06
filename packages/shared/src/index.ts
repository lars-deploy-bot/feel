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
 * const envVarName = ENV_VARS.STREAM_SESSION_COOKIE // "STREAM_SESSION_COOKIE"
 * const sitesRoot = PATHS.SITES_ROOT // "/srv/webalive/sites"
 * ```
 */

export {
  type AutomationTriggerRequest,
  AutomationTriggerRequestSchema,
  type AutomationTriggerResponse,
  AutomationTriggerResponseSchema,
} from "./automation-schemas.js"
export {
  assertValidServerId,
  CONFIG_PATH,
  CONTACT_EMAIL,
  DEFAULTS,
  DOMAINS,
  getEnvFilePath,
  getServerId,
  getServiceName,
  getSiteHome,
  getSiteUser,
  isAliveWorkspace,
  PATHS,
  PORTS,
  requireEnv,
  resolveTemplatePath,
  SECURITY,
  SENTRY,
  STANDALONE,
  STREAM_ENV,
  type StreamEnv,
  SUPERADMIN,
  TIMEOUTS,
} from "./config.js"
export {
  buildPreviewUrl,
  COOKIE_NAMES,
  createTestStorageState,
  createWorkspaceStorageValue,
  DEFAULT_TEMPLATE_ID,
  dollarsToTokens,
  domainToPreviewLabel,
  ENV_VARS,
  FEATURE_FLAGS,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
  FREE_CREDITS,
  formatTokensAsDollars,
  LIMITS,
  PREVIEW_MESSAGES,
  PREVIEW_PREFIX,
  REFERRAL,
  RESERVED_USER_ENV_KEYS,
  SESSION_MAX_AGE,
  STREAM_INTERRUPT_SOURCES,
  STREAM_SYNTHETIC_MESSAGE_TYPES,
  STREAM_TYPES,
  STREAMING,
  type StorageEntry,
  type StreamType,
  SUPERADMIN_WORKSPACE_NAME,
  TEMPLATE_ID_PREFIX,
  TEST_CONFIG,
  type TestStorageStateOptions,
  TOKENS_PER_DOLLAR,
  tokensToDollars,
  WORKER_POOL,
  WORKSPACE_STORAGE,
  type WorkspaceStorageRecentItem,
  type WorkspaceStorageState,
  type WorkspaceStorageValue,
} from "./constants.js"
export {
  type CorsDomainsConfig,
  getAllowedOrigin,
  isAllowedOrigin,
} from "./cors.js"
export {
  // Deduplication cache
  createDedupeCache,
  createPrefixedDedupeCache,
  type DedupeCache,
  type DedupeCacheOptions,
} from "./dedupe.js"
export {
  type Environment,
  type EnvironmentKey,
  environments,
  getEnvironment,
} from "./environments.js"
export {
  // Error utilities
  extractErrorCode,
  formatUncaughtError,
  isAbortError,
  isConfigError,
  isFatalError,
  isRetryableNetworkError,
  isTransientNetworkError,
} from "./errors.js"
export { type AutomationExecutionGate, getAutomationExecutionGate } from "./execution-guard.js"
export {
  buildSafeExternalPrompt,
  // External content security (prompt injection protection)
  detectSuspiciousPatterns,
  type ExternalContentSource,
  getHookType,
  isExternalHookSession,
  sanitizePromptInput,
  type WrapExternalContentOptions,
  wrapExternalContent,
} from "./external-content.js"
// invite-code.ts uses node:crypto — import via "@webalive/shared/invite-code" (server-only)
export type {
  ManagerPasswordResetToken,
  // Manager API response types - shared contract between apps/api and apps/manager
  ManagerUser,
  ManagerUserDevice,
  ManagerUserEvent,
  ManagerUserLocation,
  ManagerUserOrg,
  ManagerUserProfile,
  ManagerUserSession,
} from "./manager-types.js"
export {
  type AllOAuthProviderKey,
  // Global MCP providers (always available, no auth required)
  GLOBAL_MCP_PROVIDERS,
  type GlobalMcpProviderConfig,
  type GlobalMcpProviderKey,
  type GlobalMcpProviderRegistry,
  getAllOAuthProviderKeys,
  getMcpToolFriendlyName,
  getOAuthKeyForProvider,
  isOAuthMcpTool,
  isValidOAuthMcpProviderKey,
  isValidOAuthProviderKey,
  // Microsoft Graph scope constants (single source of truth)
  MICROSOFT_GRAPH_SCOPES,
  // OAuth MCP providers (require authentication)
  OAUTH_MCP_PROVIDERS,
  // OAuth-only providers (no MCP server, just token storage)
  OAUTH_ONLY_PROVIDERS,
  type OAuthMcpProviderConfig,
  type OAuthMcpProviderKey,
  type OAuthMcpProviderRegistry,
  type OAuthOnlyProviderConfig,
  type OAuthOnlyProviderKey,
  type OAuthOnlyProviderRegistry,
  type ProviderTokenMap,
  providerSupportsOAuth,
  providerSupportsPat,
} from "./mcp-providers.js"
export {
  ALL_CLAUDE_MODELS,
  // Claude models - SINGLE SOURCE OF TRUTH
  CLAUDE_MODELS,
  type ClaudeModel,
  DEFAULT_CLAUDE_MODEL,
  getModelDisplayName,
  isRetiredModel,
  isValidClaudeModel,
} from "./models.js"
export {
  formatProviderName,
  type OAuthFetchResult,
  type OAuthWarning,
  type OAuthWarningCategory,
  type OAuthWarningContent,
} from "./oauth-warnings.js"
export {
  buildSessionOrgClaims,
  isOrgAdminRole,
  isOrgRole,
  isOrgRoleWithViewer,
  ORG_ROLES,
  type OrgMembershipLike,
  type OrgRole,
  type OrgRoleMap,
  type OrgRoleWithViewer,
  type SessionOrgClaims,
} from "./org-roles.js"
export {
  type TruncateOptions,
  // Output limiting utilities
  truncateOutput,
} from "./output-limits.js"
// path-security.ts uses node:path — import via "@webalive/shared/path-security" (server-only)
export {
  type BackoffPolicy,
  computeBackoff,
  type RetryConfig,
  type RetryInfo,
  type RetryOptions,
  resolveRetryConfig,
  // Retry utilities
  retryAsync,
  sleepWithAbort,
} from "./retry.js"
export { parseServerConfig, type ServerConfig } from "./server-config-schema.js"
export {
  parseSiteMetadata,
  SITE_METADATA_FILENAME,
  type SiteMetadata,
  SiteMetadataSchema,
} from "./site-metadata.js"
export {
  // Stream protocol events
  type BaseStreamEvent,
  ERROR_CODES,
  type ErrorCode,
  type InterruptSource,
  isStreamEvent,
  type StreamChunkEvent,
  type StreamCompleteEvent,
  type StreamErrorEvent,
  type StreamEvent,
  type StreamEventType,
  type StreamInterruptEvent,
  type StreamMessageEvent,
  type StreamMessageType,
  type StreamStartEvent,
  type StreamState,
  type StreamStateEvent,
} from "./stream-events.js"
export type {
  // Stream token types
  CancelResponse,
  ReplayResponse,
  StreamStartRequest,
  StreamStartResponse,
  StreamTokenPayload,
  TokenRequest,
  TokenResponse,
} from "./stream-tokens.js"
export { SUPER_TEMPLATE_CATEGORIES } from "./super-template-categories.js"
export {
  getTemplateIdsInline,
  getTemplateListForDocs,
  // Website templates - SINGLE SOURCE OF TRUTH
  TEMPLATES,
  type Template,
  type TemplateIcon,
  type TemplateId,
} from "./templates.js"
export {
  // Text utilities
  truncateMarkdown,
} from "./text-utils.js"
export {
  getInternalMcpToolNames,
  INTERNAL_TOOL_DESCRIPTORS,
  type InternalMcpServer,
  type InternalToolDescriptor,
  qualifiedMcpName,
} from "./tools/internal-tool-descriptors.js"
export {
  // MCP tool settings (tunable limits)
  CLARIFICATION_MAX_QUESTIONS,
  CLARIFICATION_OPTIONS_PER_QUESTION,
  LOGS_DEBUG_DEFAULT_LINES,
  LOGS_DEFAULT_LINES,
  LOGS_MAX_LINES,
  SESSIONS_HISTORY_DEFAULT_LIMIT,
  SESSIONS_HISTORY_MAX_LIMIT,
  SESSIONS_LIST_DEFAULT_LIMIT,
  SESSIONS_LIST_MAX_LIMIT,
  SESSIONS_LIST_MAX_MESSAGE_PREVIEW,
  SESSIONS_SEND_DEFAULT_TIMEOUT_SECONDS,
  SESSIONS_SEND_MAX_TIMEOUT_SECONDS,
  WEBSITE_SITE_IDEAS_MAX_CHARS,
  WEBSITE_SLUG_MAX_LENGTH,
  WEBSITE_SLUG_MIN_LENGTH,
} from "./tools/mcp-settings.js"
export {
  buildStreamToolRuntimeConfig,
  createStreamCanUseTool,
  createStreamToolContext,
  getAccessibleStreamModes,
  getStreamAllowedTools,
  getStreamDisallowedTools,
  getStreamMcpServers,
  getStreamToolDecision,
  getToolActionLabel,
  getToolDetail,
  isHeavyBashCommand,
  isStreamClientVisibleTool,
  isStreamInitVisibleTool,
  isStreamPolicyTool,
  isUserApprovalTool,
  resolveStreamMode,
  SDK_TOOL,
  SDK_TOOL_LOWER,
  type SdkToolKey,
  STREAM_MODE_KEYS,
  STREAM_MODES,
  STREAM_PERMISSION_MODE,
  STREAM_SDK_TOOL_NAMES,
  STREAM_SETTINGS_SOURCES,
  STREAM_TOOL_POLICY_REGISTRY,
  type StreamMcpServerConfig,
  type StreamMode,
  type StreamModeConfig,
  type StreamPolicyToolName,
  type StreamSdkToolLowerName,
  type StreamSdkToolName,
  type StreamToolContext,
  type StreamToolDecision,
  type StreamToolRole,
  type StreamToolRuntimeConfig,
  type StreamToolVisibility,
  type StreamWorkspaceKind,
  type ToolDetailOptions,
} from "./tools/stream-tools.js"
export { getWorkspacePath } from "./tools/stream-tools-server.js"
export {
  getRequiredDirectories,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_SCHEMA_VERSION_FILE,
  type WorkspaceMigration,
} from "./workspace-schema.js"
