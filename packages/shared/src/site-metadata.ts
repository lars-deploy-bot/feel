import { z } from "zod"

/**
 * Filename used to store per-site metadata on disk.
 * Lives at the site root: `/srv/webalive/sites/<domain>/.site-metadata.json`
 */
export const SITE_METADATA_FILENAME = ".site-metadata.json"

/**
 * Zod schema for `.site-metadata.json`.
 *
 * Every newly deployed site writes this file. Pre-metadata sites (created
 * before the schema was introduced) may not have one — consumers must handle
 * the `null` case gracefully instead of throwing.
 */
export const SiteMetadataSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be lowercase alphanumeric with hyphens"),
    domain: z.string().min(1).includes("."),
    workspace: z.string().min(1).includes("."),
    email: z.string().email(),
    siteIdeas: z.string(),
    createdAt: z.number().int().positive(),
    templateId: z.string().min(1).optional(),
    source: z.literal("github-import").optional(),
    sourceRepo: z.string().min(1).optional(),
  })
  .refine(data => data.source !== "github-import" || (data.sourceRepo && data.sourceRepo.length > 0), {
    message: "sourceRepo is required when source is github-import",
    path: ["sourceRepo"],
  })

export type SiteMetadata = z.infer<typeof SiteMetadataSchema>

/**
 * Parse and validate raw JSON against the site metadata schema.
 * Throws with a descriptive message on validation failure.
 */
export function parseSiteMetadata(raw: unknown, context: string): SiteMetadata {
  const result = SiteMetadataSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ")
    throw new Error(`Invalid site metadata (${context}): ${issues}`)
  }
  return result.data
}
