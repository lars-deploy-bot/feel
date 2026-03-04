import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { cn } from "@/lib/utils"
import { hasMarkdown } from "@/lib/utils/markdown-utils"
import type { UIMessage } from "../../lib/message-parser"
import { ChatAttachments } from "./ChatAttachments"
import { filledBg, messageText, roundedContainer } from "./styles"

interface UserMessageProps {
  content: string
  attachments?: UIMessage["attachments"]
}

/**
 * Renders a user message with optional attachments (images, PDFs, supertemplates)
 * Uses structured data instead of parsing strings
 */
export function UserMessage({ content, attachments }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-full md:max-w-2xl">
        {/* Attachments */}
        <ChatAttachments attachments={attachments} />

        {/* User message text */}
        <div className={cn("inline-block px-4 py-2.5", filledBg, roundedContainer)}>
          {hasMarkdown(content) ? (
            <MarkdownDisplay content={content} />
          ) : (
            <p className={cn(messageText, "m-0")}>{content}</p>
          )}
        </div>
      </div>
    </div>
  )
}
