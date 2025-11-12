import type { Attachment } from "../components/ChatInput/types"

/**
 * Builds the final prompt with attachments:
 * - User prompts: Prepended to the message
 * - Library images: Wrapped with structured context and usage instructions
 * - Supertemplates: Appended as MCP tool triggers
 */
export function buildPromptWithAttachments(message: string, attachments: Attachment[]): string {
  const libraryImages = attachments.filter(a => a.kind === "library-image")
  const supertemplates = attachments.filter(a => a.kind === "supertemplate")
  const userPrompts = attachments.filter(a => a.kind === "user-prompt")

  // Start with user message
  let prompt = message

  // Prepend user prompts at the very beginning
  if (userPrompts.length > 0) {
    const promptTexts = userPrompts.map(p => p.data).join("\n\n")
    prompt = message.trim() ? `${promptTexts}\n\n${prompt}` : promptTexts
  }

  // Wrap with library images context if any exist
  if (libraryImages.length > 0) {
    const imagesList = libraryImages
      .map(img => {
        const [domain, hash] = img.photobookKey.split("/")
        if (!domain || !hash) {
          console.warn(`Invalid photobookKey format: ${img.photobookKey}`)
          return null
        }
        return `  - /_images/t/${domain}/o/${hash}/v/orig.webp`
      })
      .filter((url): url is string => url !== null)
      .join("\n")

    // Prepend images context and wrap original message
    prompt = `<images_attached>
The user has attached ${libraryImages.length} image${libraryImages.length > 1 ? "s" : ""} from their photobook:

${imagesList}

IMPORTANT: These are WEB URLs, NOT files in your workspace. Do NOT try to read, inspect, or access these files with Read, Glob, Grep, or Bash tools. They are already uploaded and served by the website's image server.

To use them, simply add them to the HTML/code with:
<img src="/_images/t/[domain]/o/[hash]/v/orig.webp" alt="..." />

The user is suggesting you might want to add ${libraryImages.length > 1 ? "these images" : "this image"} to the website.
</images_attached>

<user_message>
${prompt}
</user_message>`
  }

  // Append supertemplate triggers if any exist
  if (supertemplates.length > 0) {
    const supertemplateTriggers = supertemplates
      .map(t => `use the supertemplate tool (MCP) integrate this following into the website: ${t.templateId}`)
      .join("\n")
    prompt = `${prompt}\n\n${supertemplateTriggers}`
  }

  return prompt
}
