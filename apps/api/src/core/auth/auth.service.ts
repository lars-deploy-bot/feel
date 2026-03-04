import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { AUTH } from "../../config/constants"
import { passwordResetTokensRepo, usersRepo } from "../../db/repos"
import { UnauthorizedError } from "../../infra/errors"
import { env } from "../../config/env"

export function verifyPasscode(passcode: string): boolean {
  const bufA = Buffer.from(passcode)
  const bufB = Buffer.from(env.ALIVE_PASSCODE)

  if (bufA.byteLength !== bufB.byteLength) {
    // Keep timing constant
    timingSafeEqual(bufA, bufA)
    return false
  }

  return timingSafeEqual(bufA, bufB)
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export interface IssuedPasswordResetToken {
  token: string
  expires_at: string
}

export async function issuePasswordResetToken(userId: string): Promise<IssuedPasswordResetToken> {
  await usersRepo.findById(userId)

  const token = `prt_${randomBytes(32).toString("base64url")}`
  const expiresAt = new Date(Date.now() + AUTH.PASSWORD_RESET_TOKEN_TTL_MS).toISOString()
  const tokenHash = hashResetToken(token)

  await passwordResetTokensRepo.issueToken({
    userId,
    tokenHash,
    expiresAt,
  })

  return {
    token,
    expires_at: expiresAt,
  }
}

export interface ConsumedPasswordResetToken {
  user_id: string
}

export async function consumePasswordResetToken(
  token: string,
  newPassword: string,
): Promise<ConsumedPasswordResetToken> {
  const tokenHash = hashResetToken(token)
  const passwordHash = await Bun.password.hash(newPassword, {
    algorithm: "bcrypt",
    cost: AUTH.PASSWORD_BCRYPT_COST,
  })

  const userId = await passwordResetTokensRepo.consumeToken({
    tokenHash,
    passwordHash,
  })

  if (!userId) {
    throw new UnauthorizedError("Invalid or expired reset token")
  }

  return {
    user_id: userId,
  }
}
