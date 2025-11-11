/**
 * Scalable template ID and version type system
 */

// Template base IDs
export const TEMPLATE_IDS = {
  CAROUSEL_THUMBNAILS: "carousel-thumbnails",
  MAP_BASIC_MARKERS: "map-basic-markers",
  UPLOAD_IMAGE_CROP: "upload-image-crop",
  VITE_API_PLUGIN: "vite-api-plugin",
  RECIPE_SYSTEM_INTERACTIVE: "recipe-system-interactive",
} as const

export type TemplateId = (typeof TEMPLATE_IDS)[keyof typeof TEMPLATE_IDS]

// All available versions
export const VERSIONS = ["v1.0.0", "v1.0.1", "v2.0.0"] as const
export type Version = (typeof VERSIONS)[number]

/**
 * Template version registry
 * Only define which versions exist for each template
 */
export const TEMPLATE_VERSION_REGISTRY = {
  [TEMPLATE_IDS.CAROUSEL_THUMBNAILS]: ["v1.0.0"] as const,
  [TEMPLATE_IDS.MAP_BASIC_MARKERS]: ["v1.0.0"] as const,
  [TEMPLATE_IDS.UPLOAD_IMAGE_CROP]: ["v1.0.0"] as const,
  [TEMPLATE_IDS.VITE_API_PLUGIN]: ["v1.0.0"] as const,
  [TEMPLATE_IDS.RECIPE_SYSTEM_INTERACTIVE]: ["v1.0.0"] as const,
} as const

/**
 * Auto-generate valid versioned template IDs from registry
 * Examples: "carousel-thumbnails-v1.0.0", "map-basic-markers-v1.0.0"
 */
export type VersionedTemplateId = {
  [K in keyof typeof TEMPLATE_VERSION_REGISTRY]: (typeof TEMPLATE_VERSION_REGISTRY)[K] extends readonly (infer V)[]
    ? `${K & string}-${V & string}`
    : never
}[keyof typeof TEMPLATE_VERSION_REGISTRY]

/**
 * Helper to create a versioned template ID with type safety
 *
 * @example
 * versionedId(TEMPLATE_IDS.CAROUSEL_THUMBNAILS, "v1.0.0") // "carousel-thumbnails-v1.0.0"
 */
export function versionedId<T extends TemplateId, V extends Version>(id: T, version: V): `${T}-${V}` {
  return `${id}-${version}` as const
}

/**
 * Parse a versioned template ID into its components
 *
 * @example
 * parseVersionedId("carousel-thumbnails-v1.0.0")
 * // { id: "carousel-thumbnails", version: "v1.0.0" }
 */
export function parseVersionedId(versionedId: string): { id: string; version: string } | null {
  const match = versionedId.match(/^(.+)-(v\d+\.\d+\.\d+)$/)
  if (!match) return null
  return { id: match[1], version: match[2] }
}

/**
 * Get all versions for a template
 */
export function getTemplateVersions(templateId: TemplateId): readonly string[] {
  return TEMPLATE_VERSION_REGISTRY[templateId] || []
}

/**
 * Get the latest version for a template
 */
export function getLatestVersion(templateId: TemplateId): string | null {
  const versions = getTemplateVersions(templateId)
  if (versions.length === 0) return null
  // Simple sort by version string (works for semantic versioning)
  return [...versions].sort().reverse()[0]
}
