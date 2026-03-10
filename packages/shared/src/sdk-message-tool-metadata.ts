export interface ToolUseMetadata {
  toolUseId: string
  toolName: string
  toolInput?: unknown
}

export interface ToolResultMetadata {
  toolUseId: string
}

export interface ToolMetadataStore {
  getToolUse: (toolUseId: string) => ToolUseMetadata | undefined
  setToolUse: (entry: ToolUseMetadata) => void
}

export interface SdkMessageToolSyncResult {
  message: unknown
  toolUses: ToolUseMetadata[]
  toolResults: ToolResultMetadata[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getContentBlocks(message: unknown): unknown[] | null {
  if (!isRecord(message)) return null
  if (!isRecord(message.message)) return null
  return Array.isArray(message.message.content) ? message.message.content : null
}

function getToolUseMetadata(block: unknown): ToolUseMetadata | null {
  if (!isRecord(block)) return null
  if (block.type !== "tool_use") return null
  if (typeof block.id !== "string") return null
  if (typeof block.name !== "string") return null

  return {
    toolUseId: block.id,
    toolName: block.name,
    toolInput: block.input,
  }
}

function getToolUseId(block: unknown): string | null {
  if (!isRecord(block)) return null
  if (block.type !== "tool_result") return null
  return typeof block.tool_use_id === "string" ? block.tool_use_id : null
}

export function createToolMetadataStore(): ToolMetadataStore {
  const entries = new Map<string, ToolUseMetadata>()

  return {
    getToolUse: (toolUseId: string) => entries.get(toolUseId),
    setToolUse: (entry: ToolUseMetadata) => {
      entries.set(entry.toolUseId, entry)
    },
  }
}

/**
 * Normalize tool metadata on SDK messages so tool_result blocks carry the same
 * tool_name/tool_input fields regardless of where the message came from.
 *
 * The store is the single source of truth for tool_use_id -> tool metadata
 * during a sequential message stream.
 */
export function syncSdkMessageToolMetadata(message: unknown, store: ToolMetadataStore): SdkMessageToolSyncResult {
  const toolUses: ToolUseMetadata[] = []
  const toolResults: ToolResultMetadata[] = []
  const blocks = getContentBlocks(message)

  if (!blocks || !isRecord(message)) {
    return { message, toolUses, toolResults }
  }

  if (message.type === "assistant") {
    for (const block of blocks) {
      const toolUse = getToolUseMetadata(block)
      if (!toolUse) continue
      store.setToolUse(toolUse)
      toolUses.push(toolUse)
    }
  }

  if (message.type === "user") {
    for (const block of blocks) {
      const toolUseId = getToolUseId(block)
      if (!toolUseId) continue

      toolResults.push({ toolUseId })

      const toolUse = store.getToolUse(toolUseId)
      if (!toolUse || !isRecord(block)) continue

      block.tool_name = toolUse.toolName
      if (toolUse.toolInput !== undefined) {
        block.tool_input = toolUse.toolInput
      }
    }
  }

  return { message, toolUses, toolResults }
}
