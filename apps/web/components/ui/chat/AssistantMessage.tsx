import { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk'
import { useState } from 'react'
import { Settings, ChevronRight, ChevronDown } from 'lucide-react'
import { Text } from '../Typography'

interface AssistantMessageProps {
  content: SDKAssistantMessage
}

export function AssistantMessage({ content }: AssistantMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="message message-assistant text-none">
        {content.message.content.map((item, index) => (
          <ToolUseItem key={index} item={item} />
        ))}
      </div>
    </div>
  )
}

function ToolUseItem({ item }: { item: any }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (item.type === 'text' && item.text) {
    return (
      <Text
        as="div"
        transform="none"
        className="whitespace-pre-wrap"
      >
        {item.text}
      </Text>
    )
  }

  if (item.type === 'tool_use') {
    const hasInput = item.input && Object.keys(item.input).length > 0

    return (
      <div className="tool-call">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="tool-header"
        >
          <Settings size={16} />
          <Text as="span" size="sm" transform="none">
            {item.name}
          </Text>
          {hasInput && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </button>
        {hasInput && isExpanded && (
          <pre className="tool-content">
            {JSON.stringify(item.input, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  return null
}