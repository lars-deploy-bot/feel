import { beforeEach, describe, expect, it, vi } from "vitest"
import { Security } from "../security"

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

import { LockboxAdapter } from "../storage"

describe("LockboxAdapter", () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    rpcMock = vi.fn()
    createClientMock.mockReturnValue({
      rpc: rpcMock,
    })
  })

  it("uses public schema RPC client instead of lockbox schema tables", () => {
    new LockboxAdapter()

    expect(createClientMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: "public" },
      }),
    )
  })

  it("saves secrets via lockbox_save RPC with instance-aware key", async () => {
    rpcMock.mockResolvedValueOnce({ data: "secret-id", error: null })
    const adapter = new LockboxAdapter({ instanceId: "google:prod", defaultTtlSeconds: 60 })

    await adapter.save("user_123", "oauth_connections", "google", "token-value")

    expect(rpcMock).toHaveBeenCalledWith(
      "lockbox_save",
      expect.objectContaining({
        p_user_id: "user_123",
        p_instance_id: "google:prod",
        p_namespace: "oauth_connections",
        p_name: "google",
      }),
    )

    const payload = rpcMock.mock.calls[0]?.[1]
    expect(payload.p_ciphertext).toMatch(/^\\x[0-9a-f]+$/i)
    expect(payload.p_iv).toMatch(/^\\x[0-9a-f]+$/i)
    expect(payload.p_auth_tag).toMatch(/^\\x[0-9a-f]+$/i)
    expect(typeof payload.p_expires_at).toBe("string")
  })

  it("maps unique constraint collisions to retryable concurrent rotation error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.save("user_123", "oauth_connections", "google", "token-value")).rejects.toThrow(
      "Concurrent rotation detected",
    )
  })

  it("returns decrypted value from lockbox_get RPC", async () => {
    const encrypted = Security.encrypt("secret-value")
    rpcMock.mockResolvedValueOnce({
      data: [{ ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.authTag }],
      error: null,
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    const result = await adapter.get("user_123", "oauth_connections", "google")

    expect(result).toBe("secret-value")
    expect(rpcMock).toHaveBeenCalledWith("lockbox_get", {
      p_user_id: "user_123",
      p_instance_id: "google:prod",
      p_namespace: "oauth_connections",
      p_name: "google",
      p_scope: {},
    })
  })

  it("returns null when lockbox_get returns no rows", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.get("user_123", "oauth_connections", "google")).resolves.toBeNull()
  })

  it("throws a descriptive error when lockbox_get RPC fails", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "Access denied: user mismatch" },
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.get("user_123", "oauth_connections", "google")).rejects.toThrow(
      "Get failed: Access denied: user mismatch",
    )
  })

  it("lists current namespace secrets via lockbox_list RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          user_secret_id: "secret_1",
          user_id: "user_123",
          instance_id: "google:prod",
          namespace: "user_env_keys",
          name: "OPENAI_API_KEY",
          ciphertext: "\\x1234",
          iv: "\\x111111111111111111111111",
          auth_tag: "\\x22222222222222222222222222222222",
          version: 1,
          is_current: true,
          scope: {},
          expires_at: null,
          last_used_at: null,
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: "user_123",
          updated_by: "user_123",
        },
      ],
      error: null,
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    const result = await adapter.list("user_123", "user_env_keys")

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("OPENAI_API_KEY")
    expect(rpcMock).toHaveBeenCalledWith("lockbox_list", {
      p_user_id: "user_123",
      p_instance_id: "google:prod",
      p_namespace: "user_env_keys",
    })
  })

  it("checks existence via lockbox_exists RPC", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.exists("user_123", "oauth_connections", "google")).resolves.toBe(true)
    expect(rpcMock).toHaveBeenCalledWith("lockbox_exists", {
      p_user_id: "user_123",
      p_instance_id: "google:prod",
      p_namespace: "oauth_connections",
      p_name: "google",
      p_scope: {},
    })
  })

  it("exists returns false when RPC returns false", async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.exists("user_123", "oauth_connections", "google")).resolves.toBe(false)
  })

  it("exists throws when RPC fails", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.exists("user_123", "oauth_connections", "google")).rejects.toThrow(
      "Exists check failed: relation does not exist",
    )
  })

  it("deletes via lockbox_delete RPC", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await adapter.delete("user_123", "oauth_connections", "google")

    expect(rpcMock).toHaveBeenCalledWith("lockbox_delete", {
      p_user_id: "user_123",
      p_instance_id: "google:prod",
      p_namespace: "oauth_connections",
      p_name: "google",
      p_scope: {},
    })
  })

  it("delete throws when RPC fails", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "permission denied" },
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.delete("user_123", "oauth_connections", "google")).rejects.toThrow(
      "Delete failed: permission denied",
    )
  })

  it("save throws descriptive error for non-23505 failures", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "insufficient privilege" },
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.save("user_123", "oauth_connections", "google", "value")).rejects.toThrow(
      "Save failed: insufficient privilege",
    )
  })

  it("get returns null when decryption fails (corrupted data)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    rpcMock.mockResolvedValueOnce({
      data: [{ ciphertext: "\\xdeadbeef", iv: `\\x${"aa".repeat(12)}`, auth_tag: `\\x${"bb".repeat(16)}` }],
      error: null,
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    const result = await adapter.get("user_123", "oauth_connections", "google")

    expect(result).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Decryption failed"))
    errorSpy.mockRestore()
  })

  it("list throws when RPC fails", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "access denied" },
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    await expect(adapter.list("user_123", "oauth_connections")).rejects.toThrow("List failed")
  })

  it("list returns empty array when no data", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    const result = await adapter.list("user_123", "oauth_connections")
    expect(result).toStrictEqual([])
  })

  it("save omits p_expires_at when no defaultTtlSeconds configured", async () => {
    rpcMock.mockResolvedValueOnce({ data: "secret-id", error: null })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" }) // no defaultTtlSeconds

    await adapter.save("user_123", "oauth_connections", "google", "value")

    const payload = rpcMock.mock.calls[0]?.[1]
    expect(payload.p_expires_at).toBeUndefined()
  })

  it("defaults instanceId to 'default' when not provided", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })
    const adapter = new LockboxAdapter()

    await adapter.exists("user_123", "oauth_connections", "google")

    expect(rpcMock).toHaveBeenCalledWith("lockbox_exists", {
      p_user_id: "user_123",
      p_instance_id: "default",
      p_namespace: "oauth_connections",
      p_name: "google",
      p_scope: {},
    })
  })

  it("list normalizes object scope to JSON string", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          user_secret_id: "s1",
          user_id: "user_123",
          instance_id: "google:prod",
          namespace: "oauth_connections",
          name: "google",
          ciphertext: "\\x1234",
          iv: `\\x${"aa".repeat(12)}`,
          auth_tag: `\\x${"bb".repeat(16)}`,
          version: 1,
          is_current: true,
          scope: { key: "value" },
          expires_at: null,
          last_used_at: null,
          deleted_at: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          created_by: null,
          updated_by: null,
        },
      ],
      error: null,
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    const result = await adapter.list("user_123", "oauth_connections")

    expect(result[0]?.scope).toBe('{"key":"value"}')
  })

  it("list preserves string scope as-is", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          user_secret_id: "s1",
          user_id: "user_123",
          instance_id: "google:prod",
          namespace: "oauth_connections",
          name: "google",
          ciphertext: "\\x1234",
          iv: `\\x${"aa".repeat(12)}`,
          auth_tag: `\\x${"bb".repeat(16)}`,
          version: 1,
          is_current: true,
          scope: "read write",
          expires_at: null,
          last_used_at: null,
          deleted_at: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          created_by: null,
          updated_by: null,
        },
      ],
      error: null,
    })
    const adapter = new LockboxAdapter({ instanceId: "google:prod" })

    const result = await adapter.list("user_123", "oauth_connections")

    expect(result[0]?.scope).toBe("read write")
  })
})
