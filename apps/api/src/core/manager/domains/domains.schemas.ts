import { z } from "zod"

export const listDomainsQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
})

export type ListDomainsQuery = z.infer<typeof listDomainsQuerySchema>
