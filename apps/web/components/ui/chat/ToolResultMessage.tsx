import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { CheckCircle, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import { useState } from 'react'

// Extended tool result type with our added tool_name
interface ToolResultContent extends ContentBlockParam {
	type: 'tool_result'
	tool_use_id: string
	content?: string
	is_error?: boolean
	tool_name?: string // Added by our parser
}

// Type guard to check if a content block is a tool result
function isToolResult(content: ContentBlockParam): content is ToolResultContent {
	return content.type === 'tool_result'
}

interface ToolResultMessageProps {
	content: SDKUserMessage
}

export function ToolResultMessage({ content }: ToolResultMessageProps) {
	return (
		<div className="py-2 mb-4">
			{content.message.content.map((result, index) => {
				if (isToolResult(result)) {
					return <ToolResult key={index} result={result} />
				}
				return null
			})}
		</div>
	)
}

function ToolResult({ result }: { result: ToolResultContent }) {
	const [isExpanded, setIsExpanded] = useState(false)

	// Use the tool name that was attached by the message parser
	const toolName = result.tool_name || 'Tool Result'

	// Parse the content to get structured tool output if it's JSON
	const getDisplayContent = () => {
		if (typeof result.content === 'string') {
			try {
				return JSON.parse(result.content)
			} catch {
				return result.content
			}
		}
		return result.content
	}

	const displayContent = getDisplayContent()

	return (
		<div className="my-1">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className={`text-sm font-medium normal-case tracking-normal hover:text-black transition-colors ${
					result.is_error ? 'text-red-600' : 'text-gray-600'
				}`}
			>
				{toolName}
				{result.is_error && ' error'}
				<span className="ml-1 text-gray-500">{isExpanded ? '−' : '+'}</span>
			</button>
			{isExpanded && (
				<div className="mt-1 max-w-full overflow-hidden">
					<pre className="text-xs text-gray-500 font-mono leading-tight overflow-auto max-h-80 p-2 bg-gray-50 border border-gray-200">
						{typeof displayContent === 'string' ? displayContent : JSON.stringify(displayContent, null, 2)}
					</pre>
				</div>
			)}
		</div>
	)
}
