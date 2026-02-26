import { z } from "zod"

export const loginBodySchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
})

export type LoginBody = z.infer<typeof loginBodySchema>
