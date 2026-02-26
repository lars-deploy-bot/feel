import { z } from "zod"

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
