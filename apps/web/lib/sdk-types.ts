import type {
	SDKMessage,
	SDKSystemMessage,
	SDKAssistantMessage,
	SDKUserMessage,
	SDKResultMessage,
} from '@anthropic-ai/claude-agent-sdk'

// Re-export types for use in other modules
export type { SDKMessage, SDKSystemMessage, SDKAssistantMessage, SDKUserMessage, SDKResultMessage }

// Re-export guards and helpers from new location
export {
	isSDKSystemMessage,
	isSDKAssistantMessage,
	isSDKUserMessage,
	isSDKResultMessage,
	extractSessionId,
	getMessageStreamData,
} from '@/types/guards/sdk'
