import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { hasMarkdown } from "@/lib/utils/markdown-utils"
import type { UIMessage } from "../../lib/message-parser"
import { ChatAttachments } from "./ChatAttachments"

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
    <div className="flex justify-end mb-6 min-w-0">
      <div className="max-w-full md:max-w-2xl min-w-0 overflow-hidden">
        <div className="text-black/60 dark:text-white/60 text-xs mb-2 text-right font-normal">you</div>

        {/* Attachments */}
        <ChatAttachments attachments={attachments} />

        {/* User message text */}
        {hasMarkdown(content) ? (
          <MarkdownDisplay content={content} />
        ) : (
          <div className="whitespace-pre-wrap break-words text-black dark:text-white font-normal leading-relaxed">
            {content}
          </div>
        )}
      </div>
    </div>
  )
}
