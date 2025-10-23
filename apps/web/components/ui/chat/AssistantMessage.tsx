import type { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages'
import { ChevronDown, ChevronRight, Settings } from 'lucide-react'
import { useState } from 'react'
import { Text } from '../Typography'
import { ToolInputRouter } from './tools/ToolInputRouter'

interface AssistantMessageProps {
	content: SDKAssistantMessage
}

export function AssistantMessage({ content }: AssistantMessageProps) {
	return (
		<div className="mb-6">
			{content.message.content.map((item, index) => (
				<ToolUseItem key={index} item={item} />
			))}
		</div>
	)
}

function ToolUseItem({ item }: { item: ContentBlock }) {
	const [isExpanded, setIsExpanded] = useState(false)

	if (item.type === 'text') {
		return <div className="whitespace-pre-wrap text-black font-thin leading-relaxed">{item.text}</div>
	}

	if (item.type === 'tool_use') {
		const hasInput = item.input && typeof item.input === 'object' && Object.keys(item.input).length > 0

		const getActionLabel = (toolName: string) => {
			switch (toolName.toLowerCase()) {
				case 'read': return 'reading'
				case 'edit': return 'editing'
				case 'write': return 'writing'
				case 'grep': return 'searching'
				case 'glob': return 'finding'
				case 'bash': return 'running'
				case 'task': return 'delegating'
				default: return toolName.toLowerCase()
			}
		}

		return (
			<div className="mb-2">
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="text-xs text-black/40 font-thin hover:text-black/60 transition-colors"
				>
					{getActionLabel(item.name)}
					{hasInput && <span className="ml-1">{isExpanded ? '−' : '+'}</span>}
				</button>
				{hasInput && isExpanded && (
					<div className="mt-1 max-w-full overflow-hidden">
						<ToolInputRouter toolName={item.name} input={item.input} />
					</div>
				)}
			</div>
		)
	}

	return null
}
