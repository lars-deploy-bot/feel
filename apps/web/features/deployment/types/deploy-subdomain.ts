import { z } from "zod"

// Form types
export interface DeploySubdomainForm {
  slug: string
  email: string
  siteIdeas?: string
  selectedTemplate?: "landing" | "recipe"
  password: string
}

// API Response types (unified)
export const DeployResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  domain: z.string().optional(),
  errors: z.array(z.string()).optional(),
})

export const DeploySubdomainResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  domain: z.string().optional(),
  chatUrl: z.string().optional(),
  error: z.string().optional(),
  details: z.unknown().optional(),
})

export type DeployResponse = z.infer<typeof DeployResponseSchema>
export type DeploySubdomainResponse = z.infer<typeof DeploySubdomainResponseSchema>

// Type guards
export function isDeployResponse(body: unknown): body is DeployResponse {
  return DeployResponseSchema.safeParse(body).success
}

export function isDeploySubdomainResponse(body: unknown): body is DeploySubdomainResponse {
  return DeploySubdomainResponseSchema.safeParse(body).success
}
