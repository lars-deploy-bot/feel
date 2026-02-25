import { z } from "zod"

export const createOrgBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  credits: z.number().int().min(0).default(0),
  ownerUserId: z.string().uuid().optional(),
})

export type CreateOrgBody = z.infer<typeof createOrgBodySchema>

export const updateCreditsBodySchema = z.object({
  credits: z.number().int().min(0),
})

export type UpdateCreditsBody = z.infer<typeof updateCreditsBodySchema>

export const addMemberBodySchema = z.object({
  userId: z.string().uuid("Must be a valid user ID"),
  role: z.string().min(1, "Role is required"),
})

export type AddMemberBody = z.infer<typeof addMemberBodySchema>
