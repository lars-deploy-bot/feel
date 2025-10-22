import { SDKMessage, SDKSystemMessage, SDKAssistantMessage, SDKUserMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import {
  StartMessage,
  SystemMessage,
  AssistantMessage,
  ToolResultMessage,
  ResultMessage,
  CompleteMessage
} from '@/components/ui/chat'
import { UIMessage, isSDKSystemMessage, isSDKAssistantMessage, isSDKUserMessage, isSDKResultMessage, getMessageComponentType } from './message-parser'

export function renderMessage(message: UIMessage): React.ReactNode {
  const componentType = getMessageComponentType(message)

  switch (componentType) {
    case 'user':
      return (
        <div className="flex justify-end">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg max-w-2xl">
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        </div>
      )

    case 'start':
      return <StartMessage data={message.content} timestamp={message.timestamp.toISOString()} />

    case 'system':
      return <SystemMessage content={message.content as SDKSystemMessage} />

    case 'assistant':
      return <AssistantMessage content={message.content as SDKAssistantMessage} />

    case 'tool_result':
      return <ToolResultMessage content={message.content as SDKUserMessage} />

    case 'result':
      return <ResultMessage content={message.content as SDKResultMessage} />

    case 'complete':
      return <CompleteMessage data={message.content} />

    default:
      return (
        <div className="text-sm text-gray-500 bg-gray-100 p-2 rounded">
          <div className="font-medium mb-1">Unknown Message Type</div>
          <pre className="text-xs">{JSON.stringify(message.content, null, 2)}</pre>
        </div>
      )
  }
}