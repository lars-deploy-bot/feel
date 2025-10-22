import { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { useState } from 'react'
import { CheckCircle, XCircle, ChevronRight, ChevronDown } from 'lucide-react'

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
    <div className="flex justify-start">
      <div className="bg-gray-100 border-l-4 border-gray-400 px-4 py-2 rounded-r-lg max-w-2xl">
        {content.message.content.map((result, index) => {
          if (isToolResult(result)) {
            return <ToolResult key={index} result={result} />
          }
          return null
        })}
      </div>
    </div>
  )
}

function ToolResult({ result }: { result: ToolResultContent }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Use the tool name that was attached by the message parser
  const toolName = result.tool_name || "Tool Result"

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

  if (result.is_error) {
    return (
      <div className="text-red-600 text-sm">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 font-medium hover:underline"
        >
          <XCircle size={16} />
          {toolName} Error
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {isExpanded && (
          <pre className="whitespace-pre-wrap text-xs mt-1">
            {typeof displayContent === 'string' ? displayContent : JSON.stringify(displayContent, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="text-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 font-medium text-green-600 mb-1 hover:underline"
      >
        <CheckCircle size={16} />
        {toolName}
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isExpanded && (
        <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-white p-2 rounded">
          {typeof displayContent === 'string' ? displayContent : JSON.stringify(displayContent, null, 2)}
        </pre>
      )}
    </div>
  )
}