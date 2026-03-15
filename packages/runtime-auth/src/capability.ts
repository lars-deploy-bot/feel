import { randomUUID } from "node:crypto"
import { jwtVerify, SignJWT } from "jose"
import { z } from "zod"
import { type RuntimeRole, RuntimeRoleSchema, type RuntimeScope, RuntimeScopeSchema } from "./scopes.js"

const RuntimeCapabilitySchema = z.object({
  iss: z.string().min(1),
  aud: z.string().min(1),
  sub: z.string().min(1),
  workspace: z.string().min(1),
  role: RuntimeRoleSchema,
  scopes: z.array(RuntimeScopeSchema).min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().uuid(),
})

export type RuntimeCapability = z.infer<typeof RuntimeCapabilitySchema>

export interface MintRuntimeCapabilityInput {
  secret: string
  issuer: string
  audience: string
  subject: string
  workspace: string
  role: RuntimeRole
  scopes: readonly RuntimeScope[]
  ttlSeconds: number
  now?: Date
}

export interface VerifyRuntimeCapabilityInput {
  secret: string
  issuer: string
  audience: string
  token: string
  currentDate?: Date
}

export class RuntimeCapabilityError extends Error {
  readonly code = "RUNTIME_CAPABILITY_INVALID"

  constructor(message: string) {
    super(message)
    this.name = "RuntimeCapabilityError"
  }
}

function requireNonEmpty(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required`)
  }
  return value
}

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(requireNonEmpty(secret, "Runtime capability secret"))
}

function dedupeScopes(scopes: readonly RuntimeScope[]): RuntimeScope[] {
  return Array.from(new Set(scopes))
}

export async function mintRuntimeCapability(input: MintRuntimeCapabilityInput): Promise<string> {
  if (input.ttlSeconds <= 0) {
    throw new Error("Runtime capability ttlSeconds must be greater than zero")
  }

  const issuedAtSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const expiresAtSeconds = issuedAtSeconds + input.ttlSeconds
  const scopes = dedupeScopes(input.scopes)

  if (scopes.length === 0) {
    throw new Error("Runtime capability scopes cannot be empty")
  }

  return new SignJWT({
    workspace: requireNonEmpty(input.workspace, "Runtime capability workspace"),
    role: input.role,
    scopes,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(requireNonEmpty(input.issuer, "Runtime capability issuer"))
    .setAudience(requireNonEmpty(input.audience, "Runtime capability audience"))
    .setSubject(requireNonEmpty(input.subject, "Runtime capability subject"))
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expiresAtSeconds)
    .setJti(randomUUID())
    .sign(encodeSecret(input.secret))
}

export async function verifyRuntimeCapability(input: VerifyRuntimeCapabilityInput): Promise<RuntimeCapability> {
  const verification = await jwtVerify(input.token, encodeSecret(input.secret), {
    issuer: requireNonEmpty(input.issuer, "Runtime capability issuer"),
    audience: requireNonEmpty(input.audience, "Runtime capability audience"),
    currentDate: input.currentDate,
  })

  const parsed = RuntimeCapabilitySchema.safeParse(verification.payload)
  if (!parsed.success) {
    throw new RuntimeCapabilityError(parsed.error.message)
  }

  return parsed.data
}

export function requireCapabilityScope(input: {
  capability: RuntimeCapability
  workspace: string
  scope: RuntimeScope
}): void {
  if (input.capability.workspace !== input.workspace) {
    throw new RuntimeCapabilityError(
      `Runtime capability workspace mismatch: ${input.capability.workspace} != ${input.workspace}`,
    )
  }
  if (!input.capability.scopes.includes(input.scope)) {
    throw new RuntimeCapabilityError(`Runtime capability missing scope: ${input.scope}`)
  }
}
