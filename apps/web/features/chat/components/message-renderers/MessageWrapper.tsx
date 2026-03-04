"use client"

import { Check, Copy, Trash2 } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { trackMessageDeleted } from "@/lib/analytics/events"
import { useDexieMessageActions } from "@/lib/db/dexieMessageStore"
import { cn } from "@/lib/utils"
import { ghostActionBtn } from "./styles"

interface MessageWrapperProps {
  messageId: string
  tabId: string
  canDelete: boolean
  align?: "left" | "right"
  /** Show copy/delete actions on hover — only for text messages */
  showActions?: boolean
  children: React.ReactNode
}

export function MessageWrapper({
  messageId,
  tabId,
  canDelete,
  align = "left",
  showActions = false,
  children,
}: MessageWrapperProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const { deleteMessagesAfter } = useDexieMessageActions()

  const handleDelete = useCallback(async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const resumeUuid = await deleteMessagesAfter(messageId, tabId)
      if (resumeUuid) trackMessageDeleted()
    } catch (error) {
      console.error("[MessageWrapper] Delete failed:", error)
    } finally {
      setIsDeleting(false)
    }
  }, [isDeleting, deleteMessagesAfter, messageId, tabId])

  const handleCopy = useCallback(() => {
    if (copied) return
    const text = contentRef.current?.innerText ?? ""
    navigator.clipboard.writeText(text.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [copied])

  return (
    <div className="group" ref={contentRef}>
      {children}
      {showActions && (
        <div
          className={cn(
            "hidden md:flex gap-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            align === "right" && "justify-end",
          )}
        >
          <button
            type="button"
            onClick={handleCopy}
            className={cn(ghostActionBtn, "hover:text-black/40 dark:hover:text-white/40")}
            aria-label="Copy message"
          >
            {copied ? <Check size={11} strokeWidth={1.5} /> : <Copy size={11} strokeWidth={1.5} />}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(ghostActionBtn, "hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50")}
              aria-label="Delete message"
            >
              <Trash2 size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
