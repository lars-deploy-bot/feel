import { z } from "zod"
import { InternalError } from "../../infra/errors"
import { iamPasswordResetRpc } from "../clients"

const consumeTokenResultSchema = z.string().nullable()

interface IssuePasswordResetTokenInput {
  userId: string
  tokenHash: string
  expiresAt: string
}

interface ConsumePasswordResetTokenInput {
  tokenHash: string
  passwordHash: string
}

export async function issueToken(input: IssuePasswordResetTokenInput): Promise<void> {
  const { error } = await iamPasswordResetRpc.rpc("issue_password_reset_token", {
    p_user_id: input.userId,
    p_token_hash: input.tokenHash,
    p_expires_at: input.expiresAt,
  })

  if (error) {
    throw new InternalError(`Failed to issue password reset token: ${error.message}`)
  }
}

export async function consumeToken(input: ConsumePasswordResetTokenInput): Promise<string | null> {
  const { data, error } = await iamPasswordResetRpc.rpc("consume_password_reset_token", {
    p_token_hash: input.tokenHash,
    p_new_password_hash: input.passwordHash,
  })

  if (error) {
    throw new InternalError(`Failed to consume password reset token: ${error.message}`)
  }

  const parsed = consumeTokenResultSchema.safeParse(data)
  if (!parsed.success) {
    throw new InternalError("Password reset token consume returned invalid response")
  }

  return parsed.data
}
