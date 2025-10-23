import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { CheckCircle, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import { useState } from 'react'
import { ToolOutputRouter } from './tools/ToolOutputRouter'

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
		<div className="mb-6">
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

	// Format tool output preview (collapsed state)
	const formatToolOutputPreview = (toolName: string, content: any): string => {
		const tool = toolName.toLowerCase()

		try {
			switch (tool) {
				case 'read':
					if (content.total_lines) return `read ${content.lines_returned || content.total_lines} lines`
					if (content.file_size) return `read image`
					if (content.total_pages) return `read pdf`
					if (content.cells) return `read notebook`
					break
				case 'write':
					if (content.bytes_written) return `wrote file`
					break
				case 'edit':
					if (content.replacements !== undefined) return `made ${content.replacements} changes`
					break
				case 'grep':
					if (content.count !== undefined) return `found ${content.count} files`
					if (content.total_matches !== undefined) return `found ${content.total_matches} matches`
					if (content.total !== undefined) return `found ${content.total} matches`
					break
				case 'glob':
					if (content.count !== undefined) return `found ${content.count} files`
					break
				case 'bash':
					if (content.exitCode !== undefined) return content.exitCode === 0 ? 'completed' : `failed (${content.exitCode})`
					break
				case 'task':
					return 'completed'
			}
		} catch (e) {
			// Fall through
		}

		return toolName.toLowerCase()
	}

	return (
		<div className="mb-2">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className={`text-xs font-thin hover:text-black/60 transition-colors ${
					result.is_error ? 'text-red-600' : 'text-black/40'
				}`}
			>
				{formatToolOutputPreview(toolName, displayContent)}
				{result.is_error && ' error'}
				<span className="ml-1">{isExpanded ? '−' : '+'}</span>
			</button>
			{isExpanded && (
				<div className="mt-1 max-w-full overflow-hidden">
					<ToolOutputRouter toolName={toolName} content={displayContent} />
				</div>
			)}
		</div>
	)
}
