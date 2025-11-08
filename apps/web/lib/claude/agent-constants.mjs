import { toolsMcp, workspaceManagementMcp } from "@alive-brug/tools"

export const BRIDGE_STREAM_TYPES = {
  START: "bridge_start",
  SESSION: "bridge_session",
  MESSAGE: "bridge_message",
  COMPLETE: "bridge_complete",
  ERROR: "bridge_error",
  PING: "bridge_ping",
  DONE: "bridge_done",
  INTERRUPT: "bridge_interrupt",
}

export const BRIDGE_SYNTHETIC_MESSAGE_TYPES = {
  WARNING: "bridge_warning",
}

export const BRIDGE_INTERRUPT_SOURCES = {
  HTTP_ABORT: "bridge_http_abort",
  CLIENT_CANCEL: "bridge_client_cancel",
}

// SDK built-in tools (file operations with workspace path validation)
export const ALLOWED_SDK_TOOLS = ["Write", "Edit", "Read", "Glob", "Grep"]

// MCP tools (handled by child process, no path validation needed in parent)
export const ALLOWED_MCP_TOOLS = [
  "mcp__workspace-management__restart_dev_server",
  "mcp__workspace-management__install_package",
  "mcp__tools__list_guides",
  "mcp__tools__get_guide",
  "mcp__tools__find_guide",
  "mcp__tools__batch_get_guides",
  "mcp__tools__generate_persona",
]

// Combined list for SDK options
export const ALLOWED_TOOLS = [...ALLOWED_SDK_TOOLS, ...ALLOWED_MCP_TOOLS]

export const DISALLOWED_TOOLS = [
  "Bash",
  "bash",
  "Shell",
  "shell",
  "Exec",
  "exec",
  "Delete",
  "delete",
  "Rm",
  "rm",
  "Remove",
  "remove",
]

export const MCP_SERVERS = {
  "workspace-management": workspaceManagementMcp,
  tools: toolsMcp,
}

export const PERMISSION_MODE = "default"
export const SETTINGS_SOURCES = []
