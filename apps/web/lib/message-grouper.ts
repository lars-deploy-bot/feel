import { UIMessage } from './message-parser'

export interface MessageGroup {
	type: 'text' | 'thinking'
	messages: UIMessage[]
	isComplete: boolean
}

export function groupMessages(messages: UIMessage[]): MessageGroup[] {
	const groups: MessageGroup[] = []
	let currentThinkingGroup: UIMessage[] = []

	const flushThinkingGroup = (isComplete: boolean = false) => {
		if (currentThinkingGroup.length > 0) {
			groups.push({
				type: 'thinking',
				messages: [...currentThinkingGroup],
				isComplete
			})
			currentThinkingGroup = []
		}
	}

	const isTextMessage = (message: UIMessage): boolean => {
		// User messages are always text
		if (message.type === 'user') return true

		// Assistant messages with only text content (no tools)
		if (message.type === 'sdk_message' && message.content?.type === 'assistant') {
			const content = message.content.message?.content || []
			return content.length === 1 && content[0]?.type === 'text'
		}

		return false
	}

	const isCompletionMessage = (message: UIMessage): boolean => {
		return message.type === 'complete' || message.type === 'result'
	}

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]

		if (isTextMessage(message)) {
			// Flush any pending thinking group as incomplete
			flushThinkingGroup(false)

			// Add text message as standalone
			groups.push({
				type: 'text',
				messages: [message],
				isComplete: true
			})
		} else {
			// Add to thinking group
			currentThinkingGroup.push(message)

			// If this is a completion message, flush the group as complete
			if (isCompletionMessage(message)) {
				flushThinkingGroup(true)
			}
		}
	}

	// Flush any remaining thinking group as incomplete
	flushThinkingGroup(false)

	return groups
}