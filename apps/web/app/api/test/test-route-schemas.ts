import { AppConstants } from "@webalive/database"
import { z } from "zod"

export const TestTenantSchema = z.object({
  userId: z.string(),
  email: z.string(),
  orgId: z.string(),
  orgName: z.string(),
  workspace: z.string(),
  workerIndex: z.number().int(),
})

export const BootstrapTenantResponseSchema = z.object({
  ok: z.literal(true),
  tenant: TestTenantSchema,
})

export const VerifyTenantSandboxSchema = z.object({
  executionMode: z.enum(AppConstants.app.Enums.execution_mode),
  sandboxId: z.string().nullable(),
  sandboxStatus: z.enum(AppConstants.app.Enums.sandbox_status).nullable(),
})

export const VerifyTenantResponseSchema = z.object({
  ready: z.boolean(),
  missing: z.string().optional(),
  reason: z.string().optional(),
  check: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  sandbox: VerifyTenantSandboxSchema.optional(),
})

export const TestE2BDomainSchema = z.object({
  domain_id: z.string(),
  hostname: z.string(),
  org_id: z.string().nullable(),
  is_test_env: z.boolean(),
  execution_mode: z.enum(AppConstants.app.Enums.execution_mode),
  sandbox_id: z.string().nullable(),
  sandbox_status: z.enum(AppConstants.app.Enums.sandbox_status).nullable(),
})

export const SeedFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
})

export const TestE2BDomainUpdateBodySchema = z.object({
  workspace: z.string().min(1),
  executionMode: z.enum(AppConstants.app.Enums.execution_mode),
  sandboxStatus: z.enum(AppConstants.app.Enums.sandbox_status).nullable().optional(),
  sandboxId: z.string().nullable().optional(),
  killSandbox: z.boolean().optional().default(false),
  resetSandboxFields: z.boolean().optional().default(false),
  restartWorkspaceWorkers: z.boolean().optional().default(false),
  seedHostFiles: z.array(SeedFileSchema).optional(),
  cleanHostFiles: z.array(z.string().min(1)).optional(),
})

export const TestE2BDomainResponseSchema = z.object({
  ok: z.literal(true),
  domain: TestE2BDomainSchema,
  kill: z
    .object({
      killed: z.boolean(),
    })
    .optional(),
  workerRestart: z
    .object({
      requested: z.boolean(),
      matched: z.number().int(),
      restarted: z.number().int(),
    })
    .optional(),
  seededFiles: z.array(z.string()).optional(),
  cleanedFiles: z.array(z.string()).optional(),
  scratchWorkspace: z.string().nullable().optional(),
})

export type TestTenant = z.infer<typeof TestTenantSchema>
export type BootstrapTenantResponse = z.infer<typeof BootstrapTenantResponseSchema>
export type VerifyTenantResponse = z.infer<typeof VerifyTenantResponseSchema>
export type VerifyTenantSandbox = z.infer<typeof VerifyTenantSandboxSchema>
export type TestE2BDomain = z.infer<typeof TestE2BDomainSchema>
export type TestE2BDomainUpdateBody = z.input<typeof TestE2BDomainUpdateBodySchema>
export type TestE2BDomainResponse = z.infer<typeof TestE2BDomainResponseSchema>
