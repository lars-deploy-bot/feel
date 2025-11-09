import { useEffect, useRef } from "react"
import type { Attachment } from "../types"
import { isTemplateAttachment } from "../types"

interface TemplateJSON {
  type: "template"
  id: string
  name: string
  preview: string
}

function isValidTemplateJSON(obj: unknown): obj is TemplateJSON {
  if (typeof obj !== "object" || obj === null) return false
  const t = obj as Record<string, unknown>
  return (
    t.type === "template" &&
    typeof t.id === "string" &&
    t.id.length > 0 &&
    typeof t.name === "string" &&
    t.name.length > 0 &&
    typeof t.preview === "string" &&
    t.preview.length > 0
  )
}

/**
 * Detects template JSON in message text and converts to attachments
 *
 * Pattern: {"type":"template","id":"...","name":"...","preview":"..."}
 * Debounced to 300ms to avoid client overload
 */
export function useTemplateDetection(
  message: string,
  setMessage: (msg: string) => void,
  attachments: Attachment[],
  addTemplateAttachment: (templateId: string, name: string, preview: string) => void,
) {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Performance: Skip detection for very long messages
    if (message.length > 50000) return

    // Set new debounced timer
    debounceTimerRef.current = setTimeout(() => {
      // Regex to find template JSON objects (order-independent)
      // Matches any JSON object containing "type":"template" regardless of property order
      const jsonRegex = /\{[^}]*"type"\s*:\s*"template"[^}]*\}/g
      const matches = message.match(jsonRegex)

      if (!matches || matches.length === 0) return

      // Get existing template IDs to prevent duplicates (type-safe)
      const existingTemplateIds = new Set(attachments.filter(isTemplateAttachment).map(a => a.templateId))

      let updatedMessage = message
      let hasChanges = false

      for (const jsonStr of matches) {
        try {
          const parsed = JSON.parse(jsonStr)

          if (isValidTemplateJSON(parsed)) {
            // Skip if already exists
            if (existingTemplateIds.has(parsed.id)) {
              // Still remove from message even if duplicate
              updatedMessage = updatedMessage.replace(jsonStr, "")
              hasChanges = true
              continue
            }

            // Add new template attachment
            addTemplateAttachment(parsed.id, parsed.name, parsed.preview)
            existingTemplateIds.add(parsed.id)

            // Remove JSON from message
            updatedMessage = updatedMessage.replace(jsonStr, "")
            hasChanges = true
          }
        } catch (error) {
          // Invalid JSON - ignore and leave as text
          console.warn("Failed to parse template JSON:", error)
        }
      }

      // Update message if we removed any JSON (preserve whitespace/newlines)
      if (hasChanges) {
        setMessage(updatedMessage.trim())
      }
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [message, attachments, setMessage, addTemplateAttachment])
}
