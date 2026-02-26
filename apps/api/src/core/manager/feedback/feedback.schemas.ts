import { z } from "zod"

export const listFeedbackQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
})

export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>
