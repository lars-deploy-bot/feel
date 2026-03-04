import { z } from "zod"

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
