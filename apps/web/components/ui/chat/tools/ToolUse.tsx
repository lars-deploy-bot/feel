import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages'
import { useState } from 'react'
import { ToolButton } from '../../base/ToolButton'
import { ScrollableCode } from '../../base/ScrollableCode'

interface ToolUseProps {
	item: ContentBlock & { type: 'tool_use' }
}

export function ToolUse({ item }: ToolUseProps) {
	const [isExpanded, setIsExpanded] = useState(false)
	const hasInput = item.input && typeof item.input === 'object' && Object.keys(item.input).length > 0

	return (
		<div className="my-1">
			<ToolButton
				onClick={() => setIsExpanded(!isExpanded)}
				isExpanded={isExpanded}
				hasContent={hasInput}
			>
				{item.name}
			</ToolButton>
			{hasInput && isExpanded && (
				<ScrollableCode content={JSON.stringify(item.input, null, 2)} />
			)}
		</div>
	)
}