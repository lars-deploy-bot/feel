import type { UIMessage } from "../../lib/message-parser"
import type {
  LibraryImageAttachment,
  SkillAttachment,
  SuperTemplateAttachment,
  UploadedFileAttachment,
  UserPromptAttachment,
} from "../ChatInput/types"

interface ChatAttachmentsProps {
  attachments: UIMessage["attachments"]
}

/**
 * ChatAttachments - Shows attachments in the chat messages (after sending)
 */
export function ChatAttachments({ attachments }: ChatAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  // Filter attachment types with proper type narrowing
  const images = attachments.filter((a): a is LibraryImageAttachment => a.kind === "library-image")
  const supertemplates = attachments.filter((a): a is SuperTemplateAttachment => a.kind === "supertemplate")
  const userPrompts = attachments.filter((a): a is UserPromptAttachment => a.kind === "user-prompt")
  const skills = attachments.filter((a): a is SkillAttachment => a.kind === "skill")
  const uploadedFiles = attachments.filter((a): a is UploadedFileAttachment => a.kind === "uploaded-file")

  return (
    <>
      {/* Image attachments */}
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 justify-end">
          {images.map((img, index) => {
            // Construct URL from photobookKey
            const [domain, hash] = (img.photobookKey || "").split("/")
            const url = domain && hash ? `/_images/t/${domain}/o/${hash}/v/w640.webp` : img.preview

            return (
              <div
                key={img.id || index}
                className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
              >
                <img src={url} alt={`Attachment ${index + 1}`} className="w-24 h-24 object-cover" loading="lazy" />
              </div>
            )
          })}
        </div>
      )}

      {/* SuperTemplate attachments */}
      {supertemplates.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 justify-end">
          {supertemplates.map((template, index) => (
            <div
              key={template.id || index}
              className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-sm"
            >
              <div className="font-medium text-black dark:text-white">{template.name || "Template"}</div>
              <div className="text-xs text-black/60 dark:text-white/60">{template.templateId}</div>
            </div>
          ))}
        </div>
      )}

      {/* Skill attachments */}
      {skills.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 justify-end">
          {skills.map((skill, index) => (
            <div
              key={skill.id || index}
              className="px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 text-sm flex items-center gap-2"
            >
              <span className="font-medium text-purple-900 dark:text-purple-100">{skill.displayName}</span>
              <span className="text-xs text-purple-600/60 dark:text-purple-400/60">
                {skill.source === "superadmin" ? "Skill" : "Custom Skill"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* User Prompt attachments */}
      {userPrompts.length > 0 && (
        <div className="mb-3 space-y-2">
          {userPrompts.map((prompt, index) => (
            <div
              key={prompt.id || index}
              className="px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">{prompt.displayName}</span>
              </div>
              <p className="text-sm text-black/80 dark:text-white/80">{prompt.userFacingDescription || prompt.data}</p>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded file attachments (files uploaded for Claude to analyze) */}
      {uploadedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 justify-end">
          {uploadedFiles.map((file, index) => {
            const isImage = file.mimeType.startsWith("image/")

            if (isImage && file.preview) {
              // Show image preview
              return (
                <div
                  key={file.id || index}
                  className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
                >
                  <img src={file.preview} alt={file.originalName} className="w-24 h-24 object-cover" loading="lazy" />
                </div>
              )
            }

            // Show file icon for non-images or images without preview
            return (
              <div
                key={file.id || index}
                className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-sm flex items-center gap-2"
              >
                <span className="text-[13px] text-zinc-400 dark:text-zinc-500">{isImage ? "IMG" : "FILE"}</span>
                <div className="min-w-0">
                  <div className="font-medium text-black dark:text-white truncate max-w-32">{file.originalName}</div>
                  <div className="text-xs text-black/60 dark:text-white/60">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
