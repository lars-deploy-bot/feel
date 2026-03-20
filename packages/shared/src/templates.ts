/**
 * Website Templates - Single Source of Truth
 *
 * All template definitions live here. Import from this file
 * instead of duplicating template arrays elsewhere.
 *
 * Used by:
 * - ask-website-config tool (MCP)
 * - create-website tool (MCP)
 * - WebsiteConfigPreview component
 * - tool-registry descriptions
 */

/**
 * Template icon types for UI rendering
 */
export type TemplateIcon = "blank" | "gallery" | "event" | "saas" | "business"

/**
 * Template definition
 */
export interface Template {
  /** Unique template ID (must start with "tmpl_") */
  id: string
  /** Human-readable name */
  name: string
  /** Short description */
  description: string
  /** Icon identifier for UI */
  icon: TemplateIcon
}

/**
 * Deployment template definition with its hosted preview domain.
 */
export interface DeploymentTemplate extends Template {
  /** Public subdomain for the template on the current server. */
  subdomain: string
}

/**
 * All available deployment templates.
 * This is the canonical source for both UI metadata and hosted template routing.
 */
export const DEPLOYMENT_TEMPLATES = [
  {
    id: "tmpl_blank",
    name: "Blank Canvas",
    description: "Minimal starter - build from scratch",
    icon: "blank",
    subdomain: "blank",
  },
  {
    id: "tmpl_gallery",
    name: "Photo Gallery",
    description: "Showcase images and portfolios",
    icon: "gallery",
    subdomain: "template1",
  },
  {
    id: "tmpl_event",
    name: "Event Page",
    description: "Perfect for launches, parties, or announcements",
    icon: "event",
    subdomain: "event",
  },
  {
    id: "tmpl_saas",
    name: "SaaS Landing",
    description: "Modern product landing page",
    icon: "saas",
    subdomain: "saas",
  },
  {
    id: "tmpl_business",
    name: "Business",
    description: "Professional company website",
    icon: "business",
    subdomain: "loodgieter",
  },
] as const satisfies readonly DeploymentTemplate[]

/**
 * All available website templates for UI selection.
 */
export const TEMPLATES: readonly Template[] = DEPLOYMENT_TEMPLATES.map(({ id, name, description, icon }) => ({
  id,
  name,
  description,
  icon,
}))

/**
 * Template IDs as a union type
 */
export type TemplateId = (typeof DEPLOYMENT_TEMPLATES)[number]["id"]

/**
 * Array of valid template IDs for validation
 */
export const TEMPLATE_IDS = DEPLOYMENT_TEMPLATES.map(t => t.id)

/**
 * Check if a string is a valid template ID
 */
export function isValidTemplateId(id: string): id is TemplateId {
  return TEMPLATE_IDS.some(templateId => templateId === id)
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id)
}

/**
 * Get deployment template by ID.
 */
export function getDeploymentTemplateById(id: string): DeploymentTemplate | undefined {
  return DEPLOYMENT_TEMPLATES.find(t => t.id === id)
}

/**
 * Build the server-local hostname for a deployment template.
 * Used for both public URLs and filesystem directory names
 * (e.g., "blank.alive.best" on Server 1, "blank.sonno.tech" on Server 2).
 */
export function getTemplateHostname(template: Pick<DeploymentTemplate, "subdomain">, wildcardDomain: string): string {
  const normalizedDomain = wildcardDomain.trim()
  if (normalizedDomain.length === 0) {
    throw new Error("Template hostname requires a non-empty wildcard domain")
  }
  return `${template.subdomain}.${normalizedDomain}`
}

/** @deprecated Use {@link getTemplateHostname} instead. */
export const getDeploymentTemplatePublicHostname = getTemplateHostname

/**
 * Generate template list for documentation/descriptions
 * Format: "- tmpl_blank: Minimal starter (default)\n- tmpl_gallery: ..."
 */
export function getTemplateListForDocs(defaultId?: string): string {
  return DEPLOYMENT_TEMPLATES.map(t => {
    const isDefault = t.id === defaultId
    return `- ${t.id}: ${t.name}${isDefault ? " (default)" : ""}`
  }).join("\n")
}

/**
 * Generate inline template list for tool descriptions
 * Format: "tmpl_blank, tmpl_gallery, tmpl_event, tmpl_saas, tmpl_business"
 */
export function getTemplateIdsInline(): string {
  return TEMPLATE_IDS.join(", ")
}
