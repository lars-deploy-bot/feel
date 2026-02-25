import * as fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalHome = process.env.HOME

describe("anthropic-oauth persistence safety", () => {
  let tempHome: string

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "oauth-home-"))
    process.env.HOME = tempHome
  })

  afterEach(() => {
    vi.doUnmock("node:fs")
    vi.unmock("node:fs")
    vi.unstubAllGlobals()
    process.env.HOME = originalHome
    fs.rmSync(tempHome, { recursive: true, force: true })
  })

  it("throws when token refresh succeeds but credential write fails", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "old-access",
          refreshToken: "old-refresh",
          expiresAt: Date.now() - 60_000,
        },
      }),
    )

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 28_800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }),
    )

    const realFs = await vi.importActual<typeof import("node:fs")>("node:fs")
    vi.doMock("node:fs", () => {
      const writeFileSync: typeof realFs.writeFileSync = (file, data, options) => {
        if (String(file).endsWith(".credentials.json")) {
          throw new Error("forced write failure")
        }
        return realFs.writeFileSync(file, data, options)
      }

      return {
        ...realFs,
        writeFileSync,
        default: {
          ...realFs,
          writeFileSync,
        },
      }
    })

    try {
      const oauth = await import("../anthropic-oauth")
      await expect(oauth.getValidAccessToken()).rejects.toThrow("forced write failure")
    } finally {
      vi.doUnmock("node:fs")
      vi.unmock("node:fs")
      vi.resetModules()
    }
  })

  it("refreshes token when minimum validity window is below threshold", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "old-access",
          refreshToken: "old-refresh",
          expiresAt: Date.now() + 30 * 60 * 1000,
        },
      }),
    )

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 28_800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }),
    )

    const oauth = await import("../anthropic-oauth")
    const result = await oauth.getValidAccessToken({ minimumValidityMs: 60 * 60 * 1000 })
    expect(result).toEqual({ accessToken: "new-access", refreshed: true })
  })

  it("does not refresh when minimum validity window is already satisfied", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "old-access",
          refreshToken: "old-refresh",
          expiresAt: Date.now() + 3 * 60 * 60 * 1000,
        },
      }),
    )

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const oauth = await import("../anthropic-oauth")
    const result = await oauth.getValidAccessToken({ minimumValidityMs: 60 * 60 * 1000 })
    expect(result).toEqual({ accessToken: "old-access", refreshed: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("suppresses repeated refresh attempts after invalid_grant for the same token chain", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "old-access",
          refreshToken: "dead-refresh",
          expiresAt: Date.now() - 60_000,
        },
      }),
    )

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const oauth = await import("../anthropic-oauth")

    const first = await oauth.getValidAccessToken()
    expect(first).toBeNull()
    const second = await oauth.getValidAccessToken()
    expect(second).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns refreshed=false when proactive window triggers refresh but invalid_grant falls back to existing token", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "still-valid-access",
          refreshToken: "dead-refresh",
          expiresAt: Date.now() + 30 * 60 * 1000,
        },
      }),
    )

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const oauth = await import("../anthropic-oauth")

    const first = await oauth.getValidAccessToken({ minimumValidityMs: 60 * 60 * 1000 })
    expect(first).toEqual({ accessToken: "still-valid-access", refreshed: false })

    const second = await oauth.getValidAccessToken({ minimumValidityMs: 60 * 60 * 1000 })
    expect(second).toEqual({ accessToken: "still-valid-access", refreshed: false })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("resumes refresh after credentials rotate (simulating /login)", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "old-access",
          refreshToken: "dead-refresh",
          expiresAt: Date.now() - 60_000,
        },
      }),
    )

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "new-access-after-login",
            refresh_token: "new-refresh-after-login",
            expires_in: 28_800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const oauth = await import("../anthropic-oauth")
    const first = await oauth.getValidAccessToken()
    expect(first).toBeNull()

    // Simulate /login writing a brand new token chain.
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "login-access",
          refreshToken: "fresh-refresh",
          expiresAt: Date.now() - 60_000,
        },
      }),
    )

    const second = await oauth.getValidAccessToken()
    expect(second).toEqual({ accessToken: "new-access-after-login", refreshed: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("hasOAuthCredentials returns true even when chain is dead (presence-only check)", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "old-access",
          refreshToken: "dead-refresh",
          expiresAt: Date.now() - 60_000,
        },
      }),
    )

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }),
    )

    const oauth = await import("../anthropic-oauth")
    // Trigger dead-chain marker
    await oauth.getValidAccessToken()
    // hasOAuthCredentials only checks file presence, not chain health.
    // Dead-chain handling is done by getValidAccessToken, which returns null → OAUTH_EXPIRED.
    expect(oauth.hasOAuthCredentials()).toBe(true)
  })

  it("keeps old refresh token when token endpoint omits refresh_token", async () => {
    const claudeDir = path.join(tempHome, ".claude")
    const credentialsPath = path.join(claudeDir, ".credentials.json")

    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o711 })
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "old-access",
          refreshToken: "old-refresh",
          expiresAt: Date.now() - 60_000,
        },
      }),
    )

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            access_token: "new-access",
            // Intentionally omit refresh_token to verify fallback behavior.
            expires_in: 28_800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }),
    )

    const oauth = await import("../anthropic-oauth")
    const result = await oauth.getValidAccessToken()
    expect(result).toEqual({ accessToken: "new-access", refreshed: true })

    const saved: { claudeAiOauth?: { refreshToken?: string } } = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"))
    expect(saved.claudeAiOauth?.refreshToken).toBe("old-refresh")
  })
})
