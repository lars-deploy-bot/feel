import type { Attachment } from "../components/ChatInput/types"

/**
 * Builds the final prompt by prepending library image references and template requests
 *
 * For library images (from PhotoMenu), prepends structured context with:
 * - List of image URLs
 * - Usage instructions
 * - User intent hint
 *
 * For templates, appends template trigger phrases for MCP tool invocation
 *
 * @param message - The user's text input
 * @param attachments - All current attachments (file uploads + library images + templates)
 * @returns The augmented prompt with library image context and template triggers
 */
export function buildPromptWithAttachments(message: string, attachments: Attachment[]): string {
  const libraryImages = attachments.filter(a => a.kind === "library-image")
  const templates = attachments.filter(a => a.kind === "template")

  // Start with user message
  let prompt = message

  // Wrap with library images context if any exist
  if (libraryImages.length > 0) {
    const imagesList = libraryImages
      .map(img => {
        // photobookKey format: "domain/hash"
        const [domain, hash] = img.photobookKey.split("/")
        return `  - /_images/t/${domain}/o/${hash}/v/orig.webp`
      })
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

  // Append template triggers if any exist
  if (templates.length > 0) {
    const templateTriggers = templates.map(t => `Use template: ${t.templateId}`).join("\n")
    prompt = `${prompt}\n\n${templateTriggers}`
  }

  return prompt
}
