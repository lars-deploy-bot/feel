import { z } from "zod"
import { ExecutionModeSchema } from "@/lib/api/schemas"

export interface DeploySubdomainForm {
  slug: string
  siteIdeas?: string
  orgId?: string
  templateId?: string
}

export const SiteLimitDetailsSchema = z.object({
  limit: z.number().optional(),
  currentCount: z.number().optional(),
})

export const DeploySubdomainResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  domain: z.string().optional(),
  chatUrl: z.string().optional(),
  orgId: z.string().optional(),
  executionMode: ExecutionModeSchema.optional(),
  error: z.string().optional(),
  details: z.union([SiteLimitDetailsSchema, z.string()]).optional(),
})

export type SiteLimitDetails = z.infer<typeof SiteLimitDetailsSchema>
export type DeploySubdomainResponse = z.infer<typeof DeploySubdomainResponseSchema>
