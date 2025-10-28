import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { AssistantMessage } from "@/components/ui/chat/messages/AssistantMessage"
import { CompleteMessage } from "@/components/ui/chat/messages/CompleteMessage"
import { ErrorResultMessage } from "@/components/ui/chat/messages/ErrorResultMessage"
import { ResultMessage } from "@/components/ui/chat/messages/ResultMessage"
import { StartMessage } from "@/components/ui/chat/messages/StartMessage"
import { SystemMessage } from "@/components/ui/chat/messages/SystemMessage"
import { ToolResultMessage } from "@/components/ui/chat/messages/ToolResultMessage"
import { type UIMessage, getMessageComponentType, isErrorResultMessage } from "@/lib/message-parser"
import type { SDKAssistantMessage, SDKResultMessage, SDKSystemMessage, SDKUserMessage } from "@/lib/sdk-types"
import { hasMarkdown } from "@/lib/utils/markdown-utils"

export function renderMessage(message: UIMessage): React.ReactNode {
  // Check for error result messages first (before component type routing)
  if (message.type === "sdk_message" && isErrorResultMessage(message.content)) {
    return <ErrorResultMessage content={message.content} />
  }

  const componentType = getMessageComponentType(message)

  switch (componentType) {
    case "user": {
      const userContent = typeof message.content === "string" ? message.content : JSON.stringify(message.content)
      return (
        <div className="flex justify-end mb-6">
          <div className="max-w-2xl">
            <div className="text-black/60 text-xs mb-2 text-right font-thin">you</div>
            {hasMarkdown(userContent) ? (
              <MarkdownDisplay content={userContent} />
            ) : (
              <div className="whitespace-pre-wrap text-black font-thin leading-relaxed">{userContent}</div>
            )}
          </div>
        </div>
      )
    }

    case "start":
      return <StartMessage data={message.content} timestamp={message.timestamp.toISOString()} />

    case "system":
      return <SystemMessage content={message.content as SDKSystemMessage} />

    case "assistant":
      return <AssistantMessage content={message.content as SDKAssistantMessage} />

    case "tool_result":
      return <ToolResultMessage content={message.content as SDKUserMessage} />

    case "result":
      return <ResultMessage content={message.content as SDKResultMessage} />

    case "complete":
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
