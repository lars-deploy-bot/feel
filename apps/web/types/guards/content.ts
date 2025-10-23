import type { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk'

export type ContentItem = SDKAssistantMessage['message']['content'][number]

// Type guards for content blocks
export function isTextBlock(item: unknown): item is Extract<ContentItem, { type: 'text' }> {
	// biome-ignore lint/suspicious/noExplicitAny: SDK type checking
	return typeof item === 'object' && item !== null && (item as any).type === 'text'
}

export function isToolUseBlock(item: unknown): item is Extract<ContentItem, { type: 'tool_use' }> {
	// biome-ignore lint/suspicious/noExplicitAny: SDK type checking
	return typeof item === 'object' && item !== null && (item as any).type === 'tool_use'
}
