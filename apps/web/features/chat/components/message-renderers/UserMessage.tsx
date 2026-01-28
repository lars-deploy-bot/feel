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
        {/* Attachments */}
        <ChatAttachments attachments={attachments} />

        {/* User message text */}
        <div className="inline-block bg-black/[0.04] dark:bg-white/[0.07] rounded-xl px-4 py-2.5">
          {hasMarkdown(content) ? (
            <MarkdownDisplay content={content} />
          ) : (
            <div className="whitespace-pre-wrap break-words text-black dark:text-white font-normal leading-relaxed">
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
