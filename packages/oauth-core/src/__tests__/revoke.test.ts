import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NoopAuditLogger, oauthAudit } from "../audit"
import { InMemoryRefreshLockManager } from "../refresh-lock"

const createClientMock = vi.hoisted(() => vi.fn())
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

const mockGetProvider = vi.hoisted(() => vi.fn())
const mockIsRevocable = vi.hoisted(() => vi.fn())

vi.mock("../providers/index", () => ({
  getProvider: mockGetProvider,
}))

vi.mock("../providers/base", () => ({
  isRefreshable: vi.fn(() => false),
  isRevocable: mockIsRevocable,
  isUserInfoProvider: vi.fn(() => false),
  isExternalIdentityProvider: vi.fn(() => false),
}))

import { OAuthManager } from "../index"
import { Security } from "../security"
import { OAUTH_TOKENS_NAMESPACE } from "../types"

function encryptedRow(blob: string) {
  const encrypted = Security.encrypt(blob)
  return {
    data: [{ ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.authTag }],
    error: null,
  }
}

function makeStoredConnectionBlob(overrides: {
  provider?: string
  credential_provider?: string
  access_token?: string
  refresh_token?: string | null
  expires_at?: string | null
  provider_metadata?: Record<string, string | number | boolean | null>
}) {
  return JSON.stringify({
    version: 1,
    provider: "stripe",
    credential_provider: "stripe",
    tenant_user_id: null,
    redirect_uri: null,
    access_token: "stripe-access-token",
    refresh_token: "stripe-refresh-token",
    expires_at: null,
    scope: "read_write",
    token_type: "Bearer",
    saved_at: new Date().toISOString(),
    cached_email: "owner@alive.local",
    provider_metadata: {
      stripe_user_id: "acct_123",
    },
    ...overrides,
  })
}

describe("OAuthManager.revoke", () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    oauthAudit.setLogger(new NoopAuditLogger())

    rpcMock = vi.fn()
    createClientMock.mockReturnValue({ rpc: rpcMock })
    mockIsRevocable.mockReturnValue(true)

    process.env.STRIPE_CLIENT_ID = "stripe-client-id"
    process.env.STRIPE_CLIENT_SECRET = "stripe-client-secret"
  })

  afterEach(() => {
    delete process.env.STRIPE_CLIENT_ID
    delete process.env.STRIPE_CLIENT_SECRET
  })

  it("passes stored provider metadata to revocable providers", async () => {
    const blob = makeStoredConnectionBlob({})
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))
    rpcMock.mockResolvedValueOnce(encryptedRow(blob))
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const revokeToken = vi.fn().mockResolvedValue(undefined)
    mockGetProvider.mockReturnValue({
      name: "stripe",
      revokeToken,
      exchangeCode: vi.fn(),
      getAuthUrl: vi.fn(),
    })

    const manager = new OAuthManager({
      provider: "stripe",
      instanceId: "stripe:test",
      namespace: OAUTH_TOKENS_NAMESPACE,
      environment: "test",
      lockManager: new InMemoryRefreshLockManager(false),
    })

    await manager.revoke("", "user-1", "stripe")

    expect(revokeToken).toHaveBeenCalledWith("stripe-access-token", "stripe-client-id", "stripe-client-secret", {
      stripe_user_id: "acct_123",
    })
    expect(rpcMock).toHaveBeenCalledWith("lockbox_delete", {
      p_user_id: "user-1",
      p_instance_id: "stripe:test",
      p_namespace: "oauth_connections",
      p_name: "stripe",
    })
  })
})
