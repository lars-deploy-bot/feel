/**
 * Security Layer - AES-256-GCM Encryption/Decryption
 *
 * Uses AES-256-GCM (Galois/Counter Mode) for authenticated encryption:
 * - 256-bit key (32 bytes)
 * - 96-bit IV (12 bytes) - random per encryption
 * - 128-bit authentication tag (16 bytes)
 *
 * Output format is Postgres bytea hex format: \x[hex_string]
 */

import crypto from "node:crypto"
import { getMasterKey } from "./config"
import type { EncryptedPayload } from "./types"

export class Security {
  /**
   * Encrypts plaintext string to Postgres bytea format
   *
   * @param plaintext - String to encrypt
   * @returns Encrypted payload with ciphertext, IV, and auth tag
   */
  static encrypt(plaintext: string): EncryptedPayload {
    const masterKey = getMasterKey()
    const iv = crypto.randomBytes(12) // 96-bit IV for GCM

    const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv)

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, "utf8")
    encrypted = Buffer.concat([encrypted, cipher.final()])

    // Get the authentication tag
    const authTag = cipher.getAuthTag()

    // Format as Postgres bytea hex: \x[hex_string]
    return {
      ciphertext: `\\x${encrypted.toString("hex")}`,
      iv: `\\x${iv.toString("hex")}`,
      authTag: `\\x${authTag.toString("hex")}`,
    }
  }

  /**
   * Decrypts Postgres bytea format back to plaintext
   *
   * @param ciphertext - Encrypted data (bytea hex format)
   * @param iv - Initialization vector (bytea hex format)
   * @param authTag - Authentication tag (bytea hex format)
   * @returns Decrypted plaintext string
   * @throws Error if decryption fails or authentication fails
   */
  static decrypt(ciphertext: string, iv: string, authTag: string): string {
    const masterKey = getMasterKey()

    // Clean bytea format (remove \x prefix if present)
    const clean = (hex: string) => (hex.startsWith("\\x") ? hex.slice(2) : hex)

    const ciphertextBuffer = Buffer.from(clean(ciphertext), "hex")
    const ivBuffer = Buffer.from(clean(iv), "hex")
    const authTagBuffer = Buffer.from(clean(authTag), "hex")

    // Validate sizes
    if (ivBuffer.length !== 12) {
      throw new Error(`Invalid IV length: ${ivBuffer.length} (expected 12 bytes)`)
    }
    if (authTagBuffer.length !== 16) {
      throw new Error(`Invalid auth tag length: ${authTagBuffer.length} (expected 16 bytes)`)
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, ivBuffer)
    decipher.setAuthTag(authTagBuffer)

    try {
      let decrypted = decipher.update(ciphertextBuffer)
      decrypted = Buffer.concat([decrypted, decipher.final()])
      return decrypted.toString("utf8")
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Validates that a string is in proper Postgres bytea hex format
   *
   * @param value - String to validate
   * @returns true if valid bytea hex format
   */
  static isByteaHex(value: string): boolean {
    return /^\\x[0-9a-f]+$/i.test(value)
  }
}
