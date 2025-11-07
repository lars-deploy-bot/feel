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

export const ALLOWED_TOOLS = [
  "Write",
  "Edit",
  "Read",
  "Glob",
  "Grep",
  "mcp__workspace-management__restart_dev_server",
  "mcp__workspace-management__install_package",
  "mcp__tools__list_guides",
  "mcp__tools__get_guide",
  "mcp__tools__generate_persona",
]

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
