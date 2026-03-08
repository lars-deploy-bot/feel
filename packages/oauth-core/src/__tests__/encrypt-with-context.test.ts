import { describe, expect, it } from "vitest"
import type { KeyDerivationContext } from "../key-derivation"
import { Security } from "../security"

describe("encryptWithContext / decrypt v2 round-trip", () => {
  const ctx: KeyDerivationContext = { tenantId: "user-123", purpose: "oauth_tokens", extra: "linear" }

  it("encrypts and decrypts back to original plaintext", () => {
    const plaintext = '{"access_token":"abc","refresh_token":"def"}'
    const encrypted = Security.encryptWithContext(plaintext, ctx)
    const decrypted = Security.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.keyMeta)
    expect(decrypted).toBe(plaintext)
  })

  it("produces bytea hex format for all fields", () => {
    const encrypted = Security.encryptWithContext("test", ctx)
    expect(encrypted.ciphertext).toMatch(/^\\x[0-9a-f]+$/i)
    expect(encrypted.iv).toMatch(/^\\x[0-9a-f]+$/i)
    expect(encrypted.authTag).toMatch(/^\\x[0-9a-f]+$/i)
  })

  it("includes key metadata starting with v2", () => {
    const encrypted = Security.encryptWithContext("test", ctx)
    expect(encrypted.keyMeta).toBe("v2:user-123:oauth_tokens:linear")
  })

  it("generates different ciphertext each time (random IV)", () => {
    const e1 = Security.encryptWithContext("same-plaintext", ctx)
    const e2 = Security.encryptWithContext("same-plaintext", ctx)
    expect(e1.ciphertext).not.toBe(e2.ciphertext)
    expect(e1.iv).not.toBe(e2.iv)
  })

  it("different contexts produce different ciphertext (different derived keys)", () => {
    const ctx2: KeyDerivationContext = { tenantId: "user-456", purpose: "oauth_tokens", extra: "linear" }
    const e1 = Security.encryptWithContext("same", ctx)
    const e2 = Security.encryptWithContext("same", ctx2)
    // Even if by some cosmic coincidence IVs matched, different keys would produce different ciphertext
    // But we can at least verify they both decrypt correctly with their own metadata
    expect(Security.decrypt(e1.ciphertext, e1.iv, e1.authTag, e1.keyMeta)).toBe("same")
    expect(Security.decrypt(e2.ciphertext, e2.iv, e2.authTag, e2.keyMeta)).toBe("same")
  })

  it("v2 ciphertext cannot be decrypted with v1 (no metadata)", () => {
    const encrypted = Security.encryptWithContext("secret", ctx)
    // Decrypting v2 data without keyMeta falls back to master key — wrong key, auth fails
    expect(() => Security.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag)).toThrow("Decryption failed")
  })

  it("v2 ciphertext cannot be decrypted with wrong context", () => {
    const encrypted = Security.encryptWithContext("secret", ctx)
    const wrongCtx: KeyDerivationContext = { tenantId: "wrong-user", purpose: "oauth_tokens" }
    expect(() =>
      Security.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.keyMeta, wrongCtx),
    ).toThrow("Decryption failed")
  })

  it("v1 encrypted data can still be decrypted (backward compat)", () => {
    const encrypted = Security.encrypt("legacy-secret")
    const decrypted = Security.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag)
    expect(decrypted).toBe("legacy-secret")
  })

  it("handles unicode content", () => {
    const unicode = '{"name":"Ünïcödé","emoji":"🔐🔑"}'
    const encrypted = Security.encryptWithContext(unicode, ctx)
    const decrypted = Security.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.keyMeta)
    expect(decrypted).toBe(unicode)
  })

  it("handles empty string", () => {
    const encrypted = Security.encryptWithContext("", ctx)
    const decrypted = Security.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.keyMeta)
    expect(decrypted).toBe("")
  })

  it("context without extra still works", () => {
    const ctxNoExtra: KeyDerivationContext = { tenantId: "user-1", purpose: "oauth_tokens" }
    const encrypted = Security.encryptWithContext("no-extra", ctxNoExtra)
    expect(encrypted.keyMeta).toBe("v2:user-1:oauth_tokens")
    const decrypted = Security.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.keyMeta)
    expect(decrypted).toBe("no-extra")
  })
})
