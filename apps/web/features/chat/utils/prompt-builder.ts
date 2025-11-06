import type { Attachment } from "../components/ChatInput/types"

/**
 * Builds the final prompt by prepending library image references
 *
 * For library images (from PhotoMenu), prepends structured context with:
 * - List of image URLs
 * - Usage instructions
 * - User intent hint
 *
 * @param message - The user's text input
 * @param attachments - All current attachments (file uploads + library images)
 * @returns The augmented prompt with library image context
 */
export function buildPromptWithAttachments(message: string, attachments: Attachment[]): string {
  const libraryImages = attachments.filter(a => a.kind === "library-image")

  if (libraryImages.length === 0) {
    return message
  }

  const imagesList = libraryImages
    .map(img => {
      // photobookKey format: "domain/hash"
      const [domain, hash] = img.photobookKey.split("/")
      return `  - /_images/t/${domain}/o/${hash}/v/orig.webp`
    })
    .join("\n")

  return `<images_attached>
The user has attached ${libraryImages.length} image${libraryImages.length > 1 ? "s" : ""} from their photobook:

${imagesList}

IMPORTANT: These are WEB URLs, NOT files in your workspace. Do NOT try to read, inspect, or access these files with Read, Glob, Grep, or Bash tools. They are already uploaded and served by the website's image server.

To use them, simply add them to the HTML/code with:
<img src="/_images/t/[domain]/o/[hash]/v/orig.webp" alt="..." />

The user is suggesting you might want to add ${libraryImages.length > 1 ? "these images" : "this image"} to the website.
</images_attached>

<user_message>
${message}
</user_message>`
}
