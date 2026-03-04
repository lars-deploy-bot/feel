import { z } from "zod"

export const loginBodySchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
})

export type LoginBody = z.infer<typeof loginBodySchema>

export const resetPasswordBodySchema = z.object({
  token: z.string().regex(/^prt_[A-Za-z0-9_-]{20,}$/, "Reset token format is invalid"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(64),
})

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>
