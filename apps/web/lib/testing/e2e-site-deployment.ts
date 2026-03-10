import { z } from "zod"
import { extractSlugFromDomain } from "@/lib/config"

export const REUSABLE_LIVE_DEPLOY_SLUG_PREFIX = "dl"

export function isReusableLiveDeploySlug(slug: string): boolean {
  return slug.startsWith(REUSABLE_LIVE_DEPLOY_SLUG_PREFIX) && /^[a-z0-9-]+$/.test(slug)
}

export function isReusableLiveDeployDomain(domain: string): boolean {
  const slug = extractSlugFromDomain(domain)
  return slug !== null && isReusableLiveDeploySlug(slug)
}

export const CleanupDeployedSiteRequestSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Invalid domain format"),
})

export const CleanupDeployedSiteResponseSchema = z.object({
  ok: z.literal(true),
  domain: z.string().min(1),
})

export type CleanupDeployedSiteRequest = z.infer<typeof CleanupDeployedSiteRequestSchema>
export type CleanupDeployedSiteResponse = z.infer<typeof CleanupDeployedSiteResponseSchema>
