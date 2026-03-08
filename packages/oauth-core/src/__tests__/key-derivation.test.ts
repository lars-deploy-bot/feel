import { describe, expect, it } from "vitest"
import {
  CURRENT_KEY_VERSION,
  deriveKey,
  getKeyForVersion,
  type KeyDerivationContext,
  metadataMatchesContext,
  parseMetadata,
  serializeMetadata,
} from "../key-derivation"

describe("deriveKey", () => {
  const masterKey = Buffer.alloc(32, 0xab) // 32 bytes of 0xab

  it("returns a 32-byte buffer", () => {
    const derived = deriveKey(masterKey, { tenantId: "user-1", purpose: "oauth_tokens" })
    expect(derived.length).toBe(32)
  })

  it("derives different keys for different tenants", () => {
    const key1 = deriveKey(masterKey, { tenantId: "user-1", purpose: "oauth_tokens" })
    const key2 = deriveKey(masterKey, { tenantId: "user-2", purpose: "oauth_tokens" })
    expect(Buffer.compare(key1, key2)).not.toBe(0)
  })

  it("derives different keys for different purposes", () => {
    const key1 = deriveKey(masterKey, { tenantId: "user-1", purpose: "oauth_tokens" })
    const key2 = deriveKey(masterKey, { tenantId: "user-1", purpose: "user_env_keys" })
    expect(Buffer.compare(key1, key2)).not.toBe(0)
  })

  it("derives different keys with different extra context", () => {
    const key1 = deriveKey(masterKey, { tenantId: "user-1", purpose: "oauth_tokens", extra: "google" })
    const key2 = deriveKey(masterKey, { tenantId: "user-1", purpose: "oauth_tokens", extra: "linear" })
    expect(Buffer.compare(key1, key2)).not.toBe(0)
  })

  it("derives different key with extra vs without extra", () => {
    const key1 = deriveKey(masterKey, { tenantId: "user-1", purpose: "oauth_tokens" })
    const key2 = deriveKey(masterKey, { tenantId: "user-1", purpose: "oauth_tokens", extra: "google" })
    expect(Buffer.compare(key1, key2)).not.toBe(0)
  })

  it("is deterministic — same inputs produce same key", () => {
    const ctx: KeyDerivationContext = { tenantId: "user-1", purpose: "oauth_tokens", extra: "linear" }
    const key1 = deriveKey(masterKey, ctx)
    const key2 = deriveKey(masterKey, ctx)
    expect(Buffer.compare(key1, key2)).toBe(0)
  })

  it("derives different keys from different master keys", () => {
    const masterKey2 = Buffer.alloc(32, 0xcd)
    const ctx: KeyDerivationContext = { tenantId: "user-1", purpose: "oauth_tokens" }
    const key1 = deriveKey(masterKey, ctx)
    const key2 = deriveKey(masterKey2, ctx)
    expect(Buffer.compare(key1, key2)).not.toBe(0)
  })

  it("throws on invalid master key length (16 bytes)", () => {
    const shortKey = Buffer.alloc(16, 0xab)
    expect(() => deriveKey(shortKey, { tenantId: "u", purpose: "p" })).toThrow(
      "Invalid master key length: 16 (expected 32 bytes)",
    )
  })

  it("throws on invalid master key length (64 bytes)", () => {
    const longKey = Buffer.alloc(64, 0xab)
    expect(() => deriveKey(longKey, { tenantId: "u", purpose: "p" })).toThrow(
      "Invalid master key length: 64 (expected 32 bytes)",
    )
  })
})

describe("serializeMetadata", () => {
  it("serializes v1 as 'v1'", () => {
    expect(serializeMetadata({ v: 1 })).toBe("v1")
  })

  it("serializes v2 with tenant and purpose", () => {
    expect(serializeMetadata({ v: 2, t: "user-1", p: "oauth_tokens" })).toBe("v2:user-1:oauth_tokens")
  })

  it("serializes v2 with extra context", () => {
    expect(serializeMetadata({ v: 2, t: "user-1", p: "oauth_tokens", e: "google" })).toBe(
      "v2:user-1:oauth_tokens:google",
    )
  })

  it("serializes v2 with empty tenant and purpose as empty strings", () => {
    expect(serializeMetadata({ v: 2 })).toBe("v2::")
  })
})

describe("parseMetadata", () => {
  it("parses 'v1' as version 1", () => {
    expect(parseMetadata("v1")).toStrictEqual({ v: 1 })
  })

  it("parses empty string as version 1", () => {
    expect(parseMetadata("")).toStrictEqual({ v: 1 })
  })

  it("parses v2 with tenant and purpose", () => {
    expect(parseMetadata("v2:user-1:oauth_tokens")).toStrictEqual({
      v: 2,
      t: "user-1",
      p: "oauth_tokens",
      e: undefined,
    })
  })

  it("parses v2 with extra context", () => {
    expect(parseMetadata("v2:user-1:oauth_tokens:google")).toStrictEqual({
      v: 2,
      t: "user-1",
      p: "oauth_tokens",
      e: "google",
    })
  })

  it("parses v2 with empty tenant/purpose as undefined", () => {
    expect(parseMetadata("v2::")).toStrictEqual({ v: 2, t: undefined, p: undefined, e: undefined })
  })

  it("parses unknown version as v1 for backward compat", () => {
    expect(parseMetadata("v99:something")).toStrictEqual({ v: 1 })
  })

  it("round-trips: serialize then parse", () => {
    const original = { v: 2 as const, t: "tenant-x", p: "user_env_keys", e: "linear" }
    const serialized = serializeMetadata(original)
    const parsed = parseMetadata(serialized)
    expect(parsed).toStrictEqual(original)
  })
})

describe("metadataMatchesContext", () => {
  it("v1 metadata always matches any context", () => {
    expect(metadataMatchesContext({ v: 1 }, { tenantId: "any", purpose: "any" })).toBe(true)
  })

  it("v2 matches when tenant, purpose, and extra all match", () => {
    expect(
      metadataMatchesContext(
        { v: 2, t: "user-1", p: "oauth_tokens", e: "google" },
        { tenantId: "user-1", purpose: "oauth_tokens", extra: "google" },
      ),
    ).toBe(true)
  })

  it("v2 matches when both have no extra", () => {
    expect(
      metadataMatchesContext({ v: 2, t: "user-1", p: "oauth_tokens" }, { tenantId: "user-1", purpose: "oauth_tokens" }),
    ).toBe(true)
  })

  it("v2 does not match when tenant differs", () => {
    expect(
      metadataMatchesContext({ v: 2, t: "user-1", p: "oauth_tokens" }, { tenantId: "user-2", purpose: "oauth_tokens" }),
    ).toBe(false)
  })

  it("v2 does not match when purpose differs", () => {
    expect(
      metadataMatchesContext(
        { v: 2, t: "user-1", p: "oauth_tokens" },
        { tenantId: "user-1", purpose: "user_env_keys" },
      ),
    ).toBe(false)
  })

  it("v2 does not match when extra differs", () => {
    expect(
      metadataMatchesContext(
        { v: 2, t: "user-1", p: "oauth_tokens", e: "google" },
        { tenantId: "user-1", purpose: "oauth_tokens", extra: "linear" },
      ),
    ).toBe(false)
  })

  it("v2 does not match when one has extra and other does not", () => {
    expect(
      metadataMatchesContext(
        { v: 2, t: "user-1", p: "oauth_tokens", e: "google" },
        { tenantId: "user-1", purpose: "oauth_tokens" },
      ),
    ).toBe(false)
  })
})

describe("getKeyForVersion", () => {
  const masterKey = Buffer.alloc(32, 0xab)

  it("v1 returns the master key directly", () => {
    const key = getKeyForVersion(masterKey, 1)
    expect(Buffer.compare(key, masterKey)).toBe(0)
  })

  it("v2 returns a derived key (different from master)", () => {
    const key = getKeyForVersion(masterKey, 2, { tenantId: "user-1", purpose: "oauth_tokens" })
    expect(key.length).toBe(32)
    expect(Buffer.compare(key, masterKey)).not.toBe(0)
  })

  it("v2 throws when context is missing", () => {
    expect(() => getKeyForVersion(masterKey, 2)).toThrow("Key derivation context required for v2 keys")
  })

  it("CURRENT_KEY_VERSION is 2", () => {
    expect(CURRENT_KEY_VERSION).toBe(2)
  })
})
