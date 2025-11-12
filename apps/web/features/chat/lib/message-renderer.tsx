import { MessageErrorBoundary } from "@/features/chat/components/MessageErrorBoundary"
import { AssistantMessage } from "@/features/chat/components/message-renderers/AssistantMessage"
import { CompactBoundaryMessage } from "@/features/chat/components/message-renderers/CompactBoundaryMessage"
import { CompleteMessage } from "@/features/chat/components/message-renderers/CompleteMessage"
import { ErrorResultMessage } from "@/features/chat/components/message-renderers/ErrorResultMessage"
import { InterruptMessage } from "@/features/chat/components/message-renderers/InterruptMessage"
import { ResultMessage } from "@/features/chat/components/message-renderers/ResultMessage"
import { StartMessage } from "@/features/chat/components/message-renderers/StartMessage"
import { SystemMessage } from "@/features/chat/components/message-renderers/SystemMessage"
import { ToolResultMessage } from "@/features/chat/components/message-renderers/ToolResultMessage"
import { UserMessage } from "@/features/chat/components/message-renderers/UserMessage"
import type {
  BridgeCompleteMessage,
  BridgeInterruptMessage,
  BridgeStartMessage,
} from "@/features/chat/lib/streaming/ndjson"
import type {
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
} from "@/features/chat/types/sdk-types"
import { getMessageComponentType, isErrorResultMessage, type UIMessage } from "./message-parser"

export function renderMessage(message: UIMessage): React.ReactNode {
  return <MessageErrorBoundary messageId={message.id}>{renderMessageContent(message)}</MessageErrorBoundary>
}

function renderMessageContent(message: UIMessage): React.ReactNode {
  // Check for error result messages first (before component type routing)
  if (message.type === "sdk_message" && isErrorResultMessage(message.content)) {
    return <ErrorResultMessage content={message.content} />
  }

  const componentType = getMessageComponentType(message)

  switch (componentType) {
    case "user": {
      const userContent = typeof message.content === "string" ? message.content : JSON.stringify(message.content)
      return <UserMessage content={userContent} attachments={message.attachments} />
    }

    case "start":
      return (
        <StartMessage
          data={message.content as BridgeStartMessage["data"]}
          timestamp={message.timestamp.toISOString()}
        />
      )

    case "system":
      return <SystemMessage content={message.content as SDKSystemMessage} />

    case "assistant":
      return <AssistantMessage content={message.content as SDKAssistantMessage} />

    case "tool_result":
      return <ToolResultMessage content={message.content as SDKUserMessage} />

    case "result":
      return <ResultMessage content={message.content as SDKResultMessage} />

    case "complete":
      return <CompleteMessage data={message.content as BridgeCompleteMessage["data"]} />

    case "compact_boundary":
      // SDK system message with compact_boundary subtype - no typed interface in SDK
      return <CompactBoundaryMessage data={message.content as any} />

    case "interrupt":
      return <InterruptMessage data={message.content as BridgeInterruptMessage["data"]} />

    default:
      return (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
          <div className="font-medium mb-1">Unknown Message Type</div>
          <pre className="text-xs">{JSON.stringify(message.content, null, 2)}</pre>
        </div>
      )
  }
}
