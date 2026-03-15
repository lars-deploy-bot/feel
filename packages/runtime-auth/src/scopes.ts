import { z } from "zod"

export const RuntimeRoleSchema = z.enum(["user", "admin", "superadmin"])
export type RuntimeRole = z.infer<typeof RuntimeRoleSchema>

export const RuntimeScopeSchema = z.enum([
  "runtime:connect",
  "runtime:ensure-running",
  "files:list",
  "files:read",
  "files:write",
  "files:delete",
  "terminal:lease",
])
export type RuntimeScope = z.infer<typeof RuntimeScopeSchema>
