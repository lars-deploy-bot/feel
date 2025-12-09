import { MessageErrorBoundary } from "@/features/chat/components/MessageErrorBoundary"
import { AgentManagerMessage } from "@/features/chat/components/message-renderers/AgentManagerMessage"
import { AssistantMessage } from "@/features/chat/components/message-renderers/AssistantMessage"
import { AuthStatusMessage } from "@/features/chat/components/message-renderers/AuthStatusMessage"
import { CompactBoundaryMessage } from "@/features/chat/components/message-renderers/CompactBoundaryMessage"
import { CompactingMessage } from "@/features/chat/components/message-renderers/CompactingMessage"
import { CompleteMessage } from "@/features/chat/components/message-renderers/CompleteMessage"
import { ErrorResultMessage } from "@/features/chat/components/message-renderers/ErrorResultMessage"
import { InterruptMessage } from "@/features/chat/components/message-renderers/InterruptMessage"
import { ResultMessage } from "@/features/chat/components/message-renderers/ResultMessage"
import { StartMessage } from "@/features/chat/components/message-renderers/StartMessage"
import { SystemMessage } from "@/features/chat/components/message-renderers/SystemMessage"
import { ToolProgressMessage } from "@/features/chat/components/message-renderers/ToolProgressMessage"
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
import {
  COMPONENT_TYPE,
  getMessageComponentType,
  isErrorResultMessage,
  type AgentManagerContent,
  type AuthStatusContent,
  type ToolProgressContent,
  type UIMessage,
} from "./message-parser"

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
    case COMPONENT_TYPE.USER: {
      const userContent = typeof message.content === "string" ? message.content : JSON.stringify(message.content)
      return <UserMessage content={userContent} attachments={message.attachments} />
    }

    case COMPONENT_TYPE.START:
      return (
        <StartMessage
          data={message.content as BridgeStartMessage["data"]}
          timestamp={message.timestamp.toISOString()}
        />
      )

    case COMPONENT_TYPE.SYSTEM:
      return <SystemMessage content={message.content as SDKSystemMessage} />

    case COMPONENT_TYPE.ASSISTANT:
      return <AssistantMessage content={message.content as SDKAssistantMessage} />

    case COMPONENT_TYPE.TOOL_RESULT:
      return <ToolResultMessage content={message.content as SDKUserMessage} />

    case COMPONENT_TYPE.RESULT:
      return <ResultMessage content={message.content as SDKResultMessage} />

    case COMPONENT_TYPE.COMPLETE:
      return <CompleteMessage data={message.content as BridgeCompleteMessage["data"]} />

    case COMPONENT_TYPE.COMPACT_BOUNDARY:
      // SDK system message with compact_boundary subtype - no typed interface in SDK
      return <CompactBoundaryMessage data={message.content as any} />

    case COMPONENT_TYPE.COMPACTING:
      return <CompactingMessage />

    case COMPONENT_TYPE.TOOL_PROGRESS:
      return <ToolProgressMessage content={message.content as ToolProgressContent} />

    case COMPONENT_TYPE.AUTH_STATUS:
      return <AuthStatusMessage content={message.content as AuthStatusContent} />

    case COMPONENT_TYPE.INTERRUPT:
      return <InterruptMessage data={message.content as BridgeInterruptMessage["data"]} />

    case COMPONENT_TYPE.AGENT_MANAGER: {
      const content = message.content as AgentManagerContent
      return <AgentManagerMessage status={content.status} message={content.message} />
    }

    default:
      return (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
          <div className="font-medium mb-1">Unknown Message Type</div>
          <pre className="text-xs">{JSON.stringify(message.content, null, 2)}</pre>
        </div>
      )
  }
}
