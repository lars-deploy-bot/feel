"use client"

import { FileText, X } from "lucide-react"
import Image from "next/image"
import { useChatInput } from "./ChatInputContext"
import { isFileUpload, isImageAttachment } from "./types"

/**
 * Attachments - our horizontal layout style
 */
export function AttachmentsGrid() {
  const { attachments, removeAttachment } = useChatInput()

  if (attachments.length === 0) return null

  return (
    <div className="px-3 pb-2 pt-3 flex flex-wrap gap-2">
      {attachments.map(attachment => (
        <div
          key={attachment.id}
          className={`relative group flex items-center gap-2 px-3 py-2 rounded-lg border ${
            attachment.error
              ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20"
              : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]"
          }`}
        >
          {isImageAttachment(attachment) && attachment.preview ? (
            <div className="w-12 h-12 relative rounded overflow-hidden">
              {attachment.preview.startsWith("blob:") ? (
                <Image
                  src={attachment.preview}
                  alt={isFileUpload(attachment) ? attachment.file.name : "Photo"}
                  fill
                  className="object-cover"
                />
              ) : (
                <img
                  src={attachment.preview}
                  alt={isFileUpload(attachment) ? attachment.file.name : "Photo"}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ) : (
            <div className="w-12 h-12 flex items-center justify-center rounded bg-black/5 dark:bg-white/5">
              <FileText className="size-6 text-black/40 dark:text-white/40" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-black dark:text-white truncate max-w-[150px]">
              {isFileUpload(attachment) ? attachment.file.name : "Photo"}
            </span>
            {attachment.error ? (
              <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[150px]" title={attachment.error}>
                Upload failed
              </span>
            ) : (
              <span className="text-xs text-black/50 dark:text-white/50">
                {isFileUpload(attachment) ? `${(attachment.file.size / 1024).toFixed(1)} KB` : "Library"}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => removeAttachment(attachment.id)}
            className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-lg"
            aria-label="Remove"
          >
            <X className="size-3" strokeWidth={3} />
          </button>

          {attachment.uploadProgress !== undefined && attachment.uploadProgress < 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10 rounded-b overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{ width: `${attachment.uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
