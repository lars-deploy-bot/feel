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

describe("runtime capability", () => {
  it("round-trips through mint and verify", async () => {
    const token = await mintRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      subject: "user-1",
      workspace: "example.alive.best",
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
    expect(capability.workspace).toBe("example.alive.best")
    expect(capability.role).toBe(RuntimeRoleSchema.enum.admin)
    expect(capability.scopes).toEqual([RuntimeScopeSchema.enum["files:read"], RuntimeScopeSchema.enum["files:list"]])
  })

  it("rejects workspace mismatches when requiring a scope", async () => {
    const token = await mintRuntimeCapability({
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      subject: "user-2",
      workspace: "one.alive.best",
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
        workspace: "two.alive.best",
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
      workspace: "example.alive.best",
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
        workspace: "example.alive.best",
        scope: RuntimeScopeSchema.enum["files:read"],
      }),
    ).toThrow(RuntimeCapabilityError)
  })
})
