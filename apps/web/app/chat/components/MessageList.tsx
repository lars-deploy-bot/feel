"use client"

import { CollapsibleToolGroup } from "@/features/chat/components/message-renderers/CollapsibleToolGroup"
import { MessageWrapper } from "@/features/chat/components/message-renderers/MessageWrapper"
import { groupToolMessages, type RenderItem } from "@/features/chat/lib/group-tool-messages"
import { renderMessage, shouldRenderMessage } from "@/features/chat/lib/message-renderer"
import type { TabMessage } from "@/lib/db/useTabMessages"

interface MessageListProps {
  messages: TabMessage[]
  tabId: string
  isDebugMode: boolean
  isAutomationRun: boolean
  onSubmitAnswer: (message: string) => void
}

export function MessageList({ messages, tabId, isDebugMode, isAutomationRun, onSubmitAnswer }: MessageListProps) {
  const filteredMessages = messages.filter((message, idx) => {
    if (message.type === "compacting") {
      const nextBoundary = messages.findIndex((m, i) => i > idx && m.type === "compact_boundary")
      if (nextBoundary >= 0) return false
    }
    return shouldRenderMessage(message, isDebugMode)
  })

  const renderItems: RenderItem[] = groupToolMessages(filteredMessages)

  return renderItems.map(item => {
    if (item.type === "group") {
      return (
        <MessageWrapper
          key={`group-${item.messages[0].id}`}
          messageId={item.messages[0].id}
          tabId={tabId}
          canDelete={false}
        >
          <CollapsibleToolGroup
            messages={item.messages}
            trailingTaskResult={item.trailingTaskResult}
            subagentSummary={item.subagentSummary}
            tabId={tabId}
            onSubmitAnswer={onSubmitAnswer}
          />
        </MessageWrapper>
      )
    }

    const { message, index } = item
    const content = renderMessage(message, {
      onSubmitAnswer,
      tabId,
    })
    if (!content) return null

    const canDelete =
      !isAutomationRun &&
      index > 0 &&
      (message.type === "user" || message.type === "sdk_message") &&
      filteredMessages.slice(0, index).some(m => {
        if (m.type !== "sdk_message") return false
        const sdkContent = m.content
        if (typeof sdkContent !== "object" || sdkContent === null) return false
        return "type" in sdkContent && sdkContent.type === "assistant" && "uuid" in sdkContent && !!sdkContent.uuid
      })

    const isTextMessage =
      message.type === "user" ||
      (message.type === "sdk_message" &&
        typeof message.content === "object" &&
        message.content !== null &&
        "type" in message.content &&
        message.content.type === "assistant")

    return (
      <MessageWrapper
        key={message.id}
        messageId={message.id}
        tabId={tabId}
        canDelete={canDelete}
        align={message.type === "user" ? "right" : "left"}
        showActions={isTextMessage}
      >
        {content}
      </MessageWrapper>
    )
  })
}
