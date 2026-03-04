import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk"

export type ContentItem = SDKAssistantMessage["message"]["content"][number]

function hasTypeField(item: unknown): item is { type: unknown } {
  return typeof item === "object" && item !== null && "type" in item
}

// Type guards for content blocks
export function isTextBlock(item: unknown): item is Extract<ContentItem, { type: "text" }> {
  return hasTypeField(item) && item.type === "text"
}

export function isToolUseBlock(item: unknown): item is Extract<ContentItem, { type: "tool_use" }> {
  return hasTypeField(item) && item.type === "tool_use"
}
