import { describe, expect, it } from "vitest"
import {
  mintRuntimeCapability,
  RuntimeCapabilityError,
  requireCapabilityScope,
  verifyRuntimeCapability,
} from "../capability.js"
import { RuntimeRoleSchema, RuntimeScopeSchema } from "../scopes.js"

const TEST_SECRET = "runtime-auth-test-secret-32-chars"
const TEST_ISSUER = "alive-web"
const TEST_AUDIENCE = "runtime-isolation-gateway"
const TEST_NOW = new Date("2026-01-01T00:00:00.000Z")

async function mintTestToken(overrides: { ttlSeconds?: number; now?: Date } = {}): Promise<string> {
  return mintRuntimeCapability({
    secret: TEST_SECRET,
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    subject: "user-test",
    workspace: "example.test.example",
    role: RuntimeRoleSchema.enum.user,
    scopes: [RuntimeScopeSchema.enum["files:read"]],
    ttlSeconds: overrides.ttlSeconds ?? 60,
    now: overrides.now ?? TEST_NOW,
  })
}

describe("runtime capability", () => {
  it("round-trips through mint and verify", async () => {
    const token = await mintRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      subject: "user-1",
      workspace: "example.test.example",
      role: RuntimeRoleSchema.enum.admin,
      scopes: [RuntimeScopeSchema.enum["files:read"], RuntimeScopeSchema.enum["files:list"]],
      ttlSeconds: 60,
      now: TEST_NOW,
    })

    const capability = await verifyRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      token,
      currentDate: TEST_NOW,
    })

    expect(capability.sub).toBe("user-1")
    expect(capability.workspace).toBe("example.test.example")
    expect(capability.role).toBe(RuntimeRoleSchema.enum.admin)
    expect(capability.scopes).toEqual([RuntimeScopeSchema.enum["files:read"], RuntimeScopeSchema.enum["files:list"]])
  })

  it("rejects workspace mismatches when requiring a scope", async () => {
    const token = await mintRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      subject: "user-2",
      workspace: "one.test.example",
      role: RuntimeRoleSchema.enum.user,
      scopes: [RuntimeScopeSchema.enum["files:read"]],
      ttlSeconds: 60,
      now: TEST_NOW,
    })

    const capability = await verifyRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      token,
      currentDate: TEST_NOW,
    })

    expect(() =>
      requireCapabilityScope({
        capability,
        workspace: "two.test.example",
        scope: RuntimeScopeSchema.enum["files:read"],
      }),
    ).toThrow(RuntimeCapabilityError)
  })

  it("rejects missing scopes", async () => {
    const token = await mintRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      subject: "user-3",
      workspace: "example.test.example",
      role: RuntimeRoleSchema.enum.user,
      scopes: [RuntimeScopeSchema.enum["files:list"]],
      ttlSeconds: 60,
      now: TEST_NOW,
    })

    const capability = await verifyRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      token,
      currentDate: TEST_NOW,
    })

    expect(() =>
      requireCapabilityScope({
        capability,
        workspace: "example.test.example",
        scope: RuntimeScopeSchema.enum["files:read"],
      }),
    ).toThrow(RuntimeCapabilityError)
  })

  it("rejects expired tokens", async () => {
    const token = await mintTestToken({ ttlSeconds: 10, now: TEST_NOW })

    // Verify at 60 seconds after issuance — well past the 10-second TTL
    const futureDate = new Date(TEST_NOW.getTime() + 60_000)

    await expect(
      verifyRuntimeCapability({
        secret: TEST_SECRET,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        token,
        currentDate: futureDate,
      }),
    ).rejects.toThrow(/timestamp check failed|"exp" claim/)
  })

  it("rejects tampered tokens", async () => {
    const token = await mintTestToken()

    // Flip a character in the signature portion (last segment)
    const parts = token.split(".")
    const sig = parts[2]
    const flipped = sig[0] === "A" ? `B${sig.slice(1)}` : `A${sig.slice(1)}`
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`

    await expect(
      verifyRuntimeCapability({
        secret: TEST_SECRET,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        token: tampered,
        currentDate: TEST_NOW,
      }),
    ).rejects.toThrow(/signature/)
  })

  it("rejects tokens with wrong audience", async () => {
    const token = await mintTestToken()

    await expect(
      verifyRuntimeCapability({
        secret: TEST_SECRET,
        issuer: TEST_ISSUER,
        audience: "wrong-audience",
        token,
        currentDate: TEST_NOW,
      }),
    ).rejects.toThrow(/aud/)
  })

  it("rejects tokens with wrong issuer", async () => {
    const token = await mintTestToken()

    await expect(
      verifyRuntimeCapability({
        secret: TEST_SECRET,
        issuer: "wrong-issuer",
        audience: TEST_AUDIENCE,
        token,
        currentDate: TEST_NOW,
      }),
    ).rejects.toThrow(/iss/)
  })

  it("rejects tokens signed with a different secret", async () => {
    const token = await mintTestToken()

    await expect(
      verifyRuntimeCapability({
        secret: "completely-different-secret-key-x",
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        token,
        currentDate: TEST_NOW,
      }),
    ).rejects.toThrow(/signature/)
  })
})
