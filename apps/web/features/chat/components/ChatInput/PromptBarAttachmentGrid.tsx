"use client"

import { ClipboardList, FileText, Globe, Loader2, Sparkles, X } from "lucide-react"
import Image from "next/image"
import { Tooltip } from "@/components/ui/Tooltip"
import { useChatInput } from "./ChatInputContext"
import {
  isFileUpload,
  isImageAttachment,
  isLibraryImage,
  isSkillAttachment,
  isSuperTemplateAttachment,
  isUserPromptAttachment,
} from "./types"

/**
 * PromptBarAttachmentGrid - Shows attachments in the chat input bar (before sending)
 *
 * Mobile-friendly design:
 * - Remove button always visible (not just on hover)
 * - Clear loading indicator with spinner overlay on thumbnail
 * - Smooth transitions for upload progress
 */
export function PromptBarAttachmentGrid() {
  const { attachments, removeAttachment, toggleImageMode } = useChatInput()

  if (attachments.length === 0) return null

  return (
    <div className="px-4 pb-1 pt-3 flex flex-wrap gap-2">
      {attachments.map(attachment => {
        const isUploading = attachment.uploadProgress !== undefined && attachment.uploadProgress < 100

        return (
          <div
            key={attachment.id}
            className={`relative group flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl transition-all duration-150 ${
              attachment.error
                ? "bg-red-50 dark:bg-red-950/20"
                : isUploading
                  ? "bg-blue-50/50 dark:bg-blue-950/20"
                  : "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.09]"
            }`}
          >
            {/* Thumbnail with loading overlay */}
            <div className="relative">
              {isSkillAttachment(attachment) ? (
                <div className="size-9 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950/30 dark:to-pink-950/30">
                  {attachment.source === "superadmin" ? (
                    <Globe className="size-4 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
              ) : isUserPromptAttachment(attachment) ? (
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
                      className={`object-cover transition-opacity duration-150 ${isUploading ? "opacity-50" : "opacity-100"}`}
                    />
                  ) : (
                    <img
                      src={attachment.preview}
                      alt={isFileUpload(attachment) ? attachment.file.name : "Photo"}
                      className={`w-full h-full object-cover transition-opacity duration-150 ${isUploading ? "opacity-50" : "opacity-100"}`}
                    />
                  )}
                </div>
              ) : (
                <div className="size-9 flex items-center justify-center rounded-lg bg-black/[0.04] dark:bg-white/[0.06]">
                  <FileText className="size-4 text-black/40 dark:text-white/40" />
                </div>
              )}

              {/* Spinner overlay during upload */}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20 dark:bg-white/10">
                  <Loader2 className="size-4 text-white dark:text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-black/80 dark:text-white/80 truncate max-w-[140px]">
                {isSkillAttachment(attachment)
                  ? attachment.displayName
                  : isUserPromptAttachment(attachment)
                    ? attachment.displayName
                    : isSuperTemplateAttachment(attachment)
                      ? attachment.name
                      : isFileUpload(attachment)
                        ? attachment.file.name
                        : "Photo"}
              </span>
              {attachment.error ? (
                <span
                  className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[140px]"
                  title={attachment.error}
                >
                  Couldn't upload
                </span>
              ) : isUploading ? (
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Uploading</span>
              ) : (
                <span className="text-[11px] text-black/60 dark:text-white/60">
                  {isSkillAttachment(attachment)
                    ? "Skill"
                    : isUserPromptAttachment(attachment)
                      ? "Prompt"
                      : isSuperTemplateAttachment(attachment)
                        ? "Template"
                        : isFileUpload(attachment)
                          ? `${(attachment.file.size / 1024).toFixed(1)} KB`
                          : "Image"}
                </span>
              )}
            </div>

            {/* Mode toggle for library images — segmented pill so it's obviously a choice */}
            {isLibraryImage(attachment) && (
              <div className="flex items-center ml-1 rounded-md bg-black/[0.04] dark:bg-white/[0.06] p-0.5">
                <Tooltip content="Place this image on your website" side="top" delayMs={300}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      if (attachment.mode === "analyze") toggleImageMode(attachment.id)
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all duration-100 ${
                      (attachment.mode ?? "website") === "website"
                        ? "bg-white dark:bg-zinc-800 text-black/80 dark:text-white/80 shadow-sm"
                        : "text-black/35 dark:text-white/30 hover:text-black/50 dark:hover:text-white/45"
                    }`}
                    aria-label="Add image to website"
                  >
                    to site
                  </button>
                </Tooltip>
                <Tooltip content="Let Alive see and analyze this image" side="top" delayMs={300}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      if (attachment.mode !== "analyze") toggleImageMode(attachment.id)
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all duration-100 ${
                      attachment.mode === "analyze"
                        ? "bg-white dark:bg-zinc-800 text-black/80 dark:text-white/80 shadow-sm"
                        : "text-black/35 dark:text-white/30 hover:text-black/50 dark:hover:text-white/45"
                    }`}
                    aria-label="Ask Claude about this image"
                  >
                    ask about
                  </button>
                </Tooltip>
              </div>
            )}

            {/* Remove button - always visible on mobile (touch devices can't hover) */}
            <button
              type="button"
              onClick={() => removeAttachment(attachment.id)}
              className="absolute -top-1.5 -right-1.5 size-5 flex items-center justify-center rounded-full bg-black/70 dark:bg-white/80 text-white dark:text-black opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-150 shadow-sm"
              aria-label="Remove"
            >
              <X className="size-3" strokeWidth={2.5} />
            </button>

            {/* Progress bar - more visible during upload */}
            {isUploading && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10 rounded-b-xl overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${attachment.uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
