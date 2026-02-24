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
