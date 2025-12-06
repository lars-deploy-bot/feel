/**
 * Template types for Super Templates UI
 * Re-exports types from @webalive/tools for UI consumption
 */

import type { TemplateListItem, TemplateCategory } from "@alive-brug/tools"

// Re-export for component usage
export type { TemplateListItem, TemplateCategory }

/**
 * Template alias for backwards compatibility with legacy components
 * TemplateListItem has same structure as old Template type
 */
export type Template = TemplateListItem

/**
 * Template categories with display names
 */
export const TEMPLATE_CATEGORIES: Record<TemplateCategory, string> = {
  components: "Components",
  setup: "Setup",
}
