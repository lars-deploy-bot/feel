import { z } from "zod"

export const TestUserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  orgId: z.string().uuid(),
  orgName: z.string().min(1),
  workspace: z.string().min(1),
  siteId: z.string().min(1),
  workerIndex: z.number().int().min(0),
})

export type TestUser = z.infer<typeof TestUserSchema>

export const BootstrapTenantResponseSchema = z.object({
  ok: z.literal(true),
  tenant: TestUserSchema,
})

export const BootstrapTenantErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string().min(1),
})

export const BootstrapTenantApiResponseSchema = z.union([
  BootstrapTenantResponseSchema,
  BootstrapTenantErrorResponseSchema,
])

export type BootstrapTenantResponse = z.infer<typeof BootstrapTenantResponseSchema>
export type BootstrapTenantErrorResponse = z.infer<typeof BootstrapTenantErrorResponseSchema>
export type BootstrapTenantApiResponse = z.infer<typeof BootstrapTenantApiResponseSchema>
