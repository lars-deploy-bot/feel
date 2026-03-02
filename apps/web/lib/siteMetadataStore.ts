import path from "node:path"
import { isPathWithinWorkspace } from "@webalive/shared"
import { z } from "zod"
import { buildSubdomain, WORKSPACE_BASE } from "./config"
import { ensureDirectory, readJsonFile, writeJsonFile } from "./utils/fs-helpers"

// --- Schema ---

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

// --- Store ---

const METADATA_FILENAME = ".site-metadata.json"

function getMetadataPath(workspace: string): string {
  return path.join(workspace, METADATA_FILENAME)
}

function assertWithinWorkspace(resolvedPath: string): void {
  if (!isPathWithinWorkspace(resolvedPath, WORKSPACE_BASE)) {
    throw new Error(`Path traversal blocked: ${resolvedPath} is outside workspace root`)
  }
}

function parseSiteMetadata(raw: unknown, context: string): SiteMetadata {
  const result = SiteMetadataSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ")
    throw new Error(`Invalid site metadata (${context}): ${issues}`)
  }
  return result.data
}

export const siteMetadataStore = {
  async getSite(slug: string): Promise<SiteMetadata | null> {
    const domain = buildSubdomain(slug)
    const workspacePath = path.resolve(WORKSPACE_BASE, domain)
    assertWithinWorkspace(workspacePath)
    const metadataPath = getMetadataPath(workspacePath)

    const raw = await readJsonFile<unknown>(metadataPath)
    if (raw === null) return null

    return parseSiteMetadata(raw, slug)
  },

  async setSite(slug: string, metadata: SiteMetadata): Promise<void> {
    const validated = parseSiteMetadata(metadata, slug)
    const workspacePath = path.resolve(WORKSPACE_BASE, validated.domain)
    assertWithinWorkspace(workspacePath)
    const metadataPath = getMetadataPath(workspacePath)

    await ensureDirectory(path.dirname(metadataPath))
    await writeJsonFile(metadataPath, validated)
  },

  async exists(slug: string): Promise<boolean> {
    const domain = buildSubdomain(slug)
    const workspacePath = path.resolve(WORKSPACE_BASE, domain)
    assertWithinWorkspace(workspacePath)
    const metadataPath = getMetadataPath(workspacePath)
    const raw = await readJsonFile<unknown>(metadataPath)
    return raw !== null
  },
}

/**
 * Read metadata from a pre-resolved workspace path.
 * Caller is responsible for path validation — this function does NOT
 * enforce workspace-root containment (workspace paths come from the
 * server, not from user input).
 */
export async function getSiteMetadataByWorkspace(workspace: string): Promise<SiteMetadata | null> {
  const metadataPath = getMetadataPath(path.resolve(workspace))
  const raw = await readJsonFile<unknown>(metadataPath)
  if (raw === null) return null
  return parseSiteMetadata(raw, workspace)
}
