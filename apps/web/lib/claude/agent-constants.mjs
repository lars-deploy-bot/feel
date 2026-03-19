import {
  buildOAuthMcpServers,
  buildStreamToolRuntimeConfig,
  createStreamToolContext,
  getStreamMcpServers,
  STREAM_INTERRUPT_SOURCES,
  STREAM_PERMISSION_MODE,
  STREAM_SETTINGS_SOURCES,
  STREAM_SYNTHETIC_MESSAGE_TYPES,
  STREAM_TYPES,
} from "@webalive/shared"
import { getEnabledMcpToolNames, streamInternalMcpServers } from "@webalive/tools"
import { getEnabledServices } from "./alive-toml-services.mjs"

// Re-export stream types
export { STREAM_TYPES, STREAM_SYNTHETIC_MESSAGE_TYPES, STREAM_INTERRUPT_SOURCES }

export const PERMISSION_MODE = STREAM_PERMISSION_MODE
/** @type {import('@anthropic-ai/claude-agent-sdk').SettingSource[]} */
export const SETTINGS_SOURCES = STREAM_SETTINGS_SOURCES

/**
 * Get base allowed tools (SDK tools + internal MCP tools)
 * @param {string} _workspacePath - Path to workspace (unused, kept for backwards compat)
 * @param {boolean} [isAdmin=false] - Whether the user is an admin (enables admin-only tools)
 * @param {boolean} [isSuperadmin=false] - Whether the user is a superadmin (re-enables Task/WebSearch, excludes member-only MCP resource tools)
 * @param {boolean} [isSuperadminWorkspace=false] - Whether this is the "alive" workspace (excludes site-specific tools)
 * @param {string} [mode="default"] - Stream mode ("default" | "plan" | "superadmin")
 * @returns {string[]} Base allowed tools list
 */
export function getAllowedTools(_workspacePath, isAdmin, isSuperadmin, isSuperadminWorkspace, mode, executionMode) {
  const enabledServices = getEnabledServices()
  const context = createStreamToolContext({
    isAdmin,
    isSuperadmin,
    isSuperadminWorkspace,
    mode,
    executionMode,
    enabledServices,
  })
  return buildStreamToolRuntimeConfig(getEnabledMcpToolNames, context).allowedTools
}

/**
 * Get disallowed tools based on admin/superadmin status
 * @param {boolean} [isAdmin=false] - Whether the user is an admin
 * @param {boolean} [isSuperadmin=false] - Whether the user is a superadmin (still blocks ExitPlanMode)
 * @param {string} [mode="default"] - Stream mode ("default" | "plan" | "superadmin")
 * @param {boolean} [isSuperadminWorkspace=false] - Whether this is the platform workspace
 * @param {string} [executionMode] - "systemd" or "e2b"
 * @returns {string[]} Disallowed tools list
 */
export function getDisallowedTools(isAdmin, isSuperadmin, mode, isSuperadminWorkspace, executionMode) {
  const enabledServices = getEnabledServices()
  const context = createStreamToolContext({
    isAdmin,
    isSuperadmin,
    isSuperadminWorkspace,
    mode,
    executionMode,
    enabledServices,
  })
  return buildStreamToolRuntimeConfig(getEnabledMcpToolNames, context).disallowedTools
}

/**
 * Get MCP servers configuration
 * @param {string} _workspacePath - Path to workspace (unused)
 * @param {Object} options - Options with oauthTokens
 * @returns {Object} MCP servers configuration
 */
export function getMcpServers(_workspacePath, options = {}) {
  return getStreamMcpServers(streamInternalMcpServers, options.oauthTokens || {})
}

/**
 * Get ONLY the OAuth MCP servers (HTTP-based, serializable via JSON).
 * Used by worker pool since internal MCP servers can't be serialized via IPC.
 * @param {Record<string, string>} [oauthTokens] - OAuth tokens keyed by provider
 * @returns {Object} OAuth MCP servers configuration (serializable)
 */
export function getOAuthMcpServers(oauthTokens = {}) {
  return buildOAuthMcpServers(oauthTokens)
}

/**
 * @deprecated Use OAuth connection checks instead
 */
export function hasStripeMcpAccess(_workspacePath, hasStripeConnection = false) {
  return hasStripeConnection
}
