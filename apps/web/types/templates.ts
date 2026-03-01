/**
 * Template types and constants for Super Templates UI
 */

import { SUPER_TEMPLATE_CATEGORIES } from "@webalive/shared"
import type { TemplateCategory, TemplateListItem } from "@webalive/tools"

// Re-export types for component usage
export type { TemplateListItem, TemplateCategory }

/**
 * Template alias for backwards compatibility with legacy components
 * TemplateListItem has same structure as old Template type
 */
export type Template = TemplateListItem

/**
 * Template categories with display names (for UI)
 * @deprecated Import SUPER_TEMPLATE_CATEGORIES from @webalive/shared instead
 */
export const TEMPLATE_CATEGORIES = SUPER_TEMPLATE_CATEGORIES
