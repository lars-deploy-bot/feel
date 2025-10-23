import type {
	SDKMessage,
	SDKSystemMessage,
	SDKAssistantMessage,
	SDKUserMessage,
	SDKResultMessage
} from '@anthropic-ai/claude-agent-sdk'

// Re-export types for use in other modules
export type {
	SDKMessage,
	SDKSystemMessage,
	SDKAssistantMessage,
	SDKUserMessage,
	SDKResultMessage
}

// Type guard for the specific system init message (the only SDKSystemMessage type)
export function isSDKSystemMessage(msg: SDKMessage): msg is SDKSystemMessage {
	return msg.type === 'system' &&
		   'subtype' in msg &&
		   (msg as any).subtype === 'init' &&
		   'session_id' in msg &&
		   'uuid' in msg
}

export function isSDKAssistantMessage(msg: SDKMessage): msg is SDKAssistantMessage {
	return msg.type === 'assistant' && 'message' in msg
}

export function isSDKUserMessage(msg: SDKMessage): msg is SDKUserMessage {
	return msg.type === 'user' && 'message' in msg
}

export function isSDKResultMessage(msg: SDKMessage): msg is SDKResultMessage {
	return msg.type === 'result' && 'is_error' in msg && 'duration_ms' in msg
}

// Helper to safely extract session ID from system init message
export function extractSessionId(msg: SDKMessage): string | null {
	if (isSDKSystemMessage(msg) && msg.subtype === 'init') {
		return msg.session_id
	}
	return null
}

// Helper to safely get message content for streaming
export function getMessageStreamData(msg: SDKMessage) {
	return {
		messageType: msg.type,
		content: msg,
	}
}