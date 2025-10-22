import type { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages'
import { ChevronDown, ChevronRight, Settings } from 'lucide-react'
import { useState } from 'react'
import { Text } from '../Typography'

interface AssistantMessageProps {
	content: SDKAssistantMessage
}

export function AssistantMessage({ content }: AssistantMessageProps) {
	return (
		<div className="py-2 mb-4">
			{content.message.content.map((item, index) => (
				<ToolUseItem key={index} item={item} />
			))}
		</div>
	)
}

function ToolUseItem({ item }: { item: ContentBlock }) {
	const [isExpanded, setIsExpanded] = useState(false)

	if (item.type === 'text') {
		return <div className="whitespace-pre-wrap normal-case tracking-normal leading-relaxed">{item.text}</div>
	}

	if (item.type === 'tool_use') {
		const hasInput = item.input && typeof item.input === 'object' && Object.keys(item.input).length > 0

		return (
			<div className="my-1">
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="text-sm text-gray-600 font-medium normal-case tracking-normal hover:text-black transition-colors"
				>
					{item.name}
					{hasInput && <span className="ml-1 text-gray-500">{isExpanded ? '−' : '+'}</span>}
				</button>
				{hasInput && isExpanded && (
					<div className="mt-1 max-w-full overflow-hidden">
						<pre className="text-xs text-gray-500 font-mono leading-tight overflow-auto max-h-80 p-2 bg-gray-50 border border-gray-200">
							{JSON.stringify(item.input, null, 2)}
						</pre>
					</div>
				)}
			</div>
		)
	}

	return null
}
