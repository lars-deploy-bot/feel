import { z } from "zod"

export const DeploySubdomainSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(20, "Slug must be no more than 20 characters")
    .regex(/^[a-z0-9]([a-z0-9-]{1,18}[a-z0-9])?$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  email: z.string().email("Please enter a valid email address"),
  siteIdeas: z
    .string()
    .max(5000, "Site ideas must be less than 5000 characters")
    .transform(val => val || "")
    .optional()
    .default(""),
  selectedTemplate: z.enum(["landing", "recipe"]).optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(16, "Password must be no more than 16 characters"),
})

export type DeploySubdomainRequest = z.infer<typeof DeploySubdomainSchema>

export function validateDeploySubdomainRequest(body: unknown) {
  return DeploySubdomainSchema.safeParse(body)
}

export function isValidDeploySubdomainRequest(body: unknown): body is DeploySubdomainRequest {
  return DeploySubdomainSchema.safeParse(body).success
}
