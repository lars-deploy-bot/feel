"use client"

import { ClipboardList, Eye, FileText, Globe, Sparkles, X } from "lucide-react"
import Image from "next/image"
import { useChatInput } from "./ChatInputContext"
import {
  isFileUpload,
  isImageAttachment,
  isLibraryImage,
  isSuperTemplateAttachment,
  isUserPromptAttachment,
} from "./types"

/**
 * PromptBarAttachmentGrid - Shows attachments in the chat input bar (before sending)
 */
export function PromptBarAttachmentGrid() {
  const { attachments, removeAttachment, toggleImageMode } = useChatInput()

  if (attachments.length === 0) return null

  return (
    <div className="px-4 pb-1 pt-3 flex flex-wrap gap-2">
      {attachments.map(attachment => (
        <div
          key={attachment.id}
          className={`relative group flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl transition-colors ${
            attachment.error
              ? "bg-red-50 dark:bg-red-950/20"
              : "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.09]"
          }`}
        >
          {isUserPromptAttachment(attachment) ? (
            <div className="size-9 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950/30 dark:to-pink-950/30">
              {attachment.promptType === "revise-code" ? (
                <ClipboardList className="size-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
              )}
            </div>
          ) : isSuperTemplateAttachment(attachment) && attachment.preview ? (
            <div className="size-9 relative rounded-lg overflow-hidden">
              <img src={attachment.preview} alt={attachment.name} className="w-full h-full object-cover" />
            </div>
          ) : isImageAttachment(attachment) && attachment.preview ? (
            <div className="size-9 relative rounded-lg overflow-hidden">
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
            <div className="size-9 flex items-center justify-center rounded-lg bg-black/[0.04] dark:bg-white/[0.06]">
              <FileText className="size-4 text-black/40 dark:text-white/40" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-black/80 dark:text-white/80 truncate max-w-[140px]">
              {isUserPromptAttachment(attachment)
                ? attachment.displayName
                : isSuperTemplateAttachment(attachment)
                  ? attachment.name
                  : isFileUpload(attachment)
                    ? attachment.file.name
                    : "Photo"}
            </span>
            {attachment.error ? (
              <span
                className="text-[11px] text-red-500 dark:text-red-400 truncate max-w-[140px]"
                title={attachment.error}
              >
                Upload failed
              </span>
            ) : (
              <span className="text-[11px] text-black/40 dark:text-white/40">
                {isUserPromptAttachment(attachment)
                  ? "User Prompt"
                  : isSuperTemplateAttachment(attachment)
                    ? "SuperTemplate"
                    : isFileUpload(attachment)
                      ? `${(attachment.file.size / 1024).toFixed(1)} KB`
                      : "Library"}
              </span>
            )}
          </div>

          {/* Mode toggle for library images */}
          {isLibraryImage(attachment) && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                toggleImageMode(attachment.id)
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ml-1 ${
                attachment.mode === "analyze"
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}
              title={
                attachment.mode === "analyze"
                  ? "Analyze mode: Claude will look at this image"
                  : "Website mode: Add this image to your site"
              }
            >
              {attachment.mode === "analyze" ? (
                <>
                  <Eye className="size-3" />
                  <span>Analyze</span>
                </>
              ) : (
                <>
                  <Globe className="size-3" />
                  <span>Website</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => removeAttachment(attachment.id)}
            className="absolute -top-1.5 -right-1.5 size-5 flex items-center justify-center rounded-full bg-black/70 dark:bg-white/80 text-white dark:text-black opacity-0 group-hover:opacity-100 hover:scale-110 transition-all duration-150 shadow-sm"
            aria-label="Remove"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>

          {attachment.uploadProgress !== undefined && attachment.uploadProgress < 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/5 dark:bg-white/5 rounded-b-xl overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${attachment.uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
