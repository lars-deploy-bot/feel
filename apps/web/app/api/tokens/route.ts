import { type NextRequest, NextResponse } from "next/server"
import { creditsToLLMTokens } from "@/lib/credits"
import { isWorkspaceAuthenticated } from "@/features/auth/lib/auth"
import { loadDomainPasswords } from "@/types/guards/api"
import type { TokensResponse, TokensErrorResponse } from "@/types/api"

export async function GET(req: NextRequest): Promise<NextResponse<TokensResponse | TokensErrorResponse>> {
  try {
    const workspace = req.headers.get("X-Workspace")

    if (!workspace) {
      return NextResponse.json<TokensErrorResponse>(
        { ok: false, error: "No workspace specified" },
        { status: 400 }
      )
    }

    // Verify user is authenticated for this workspace using JWT
    const isAuthenticated = await isWorkspaceAuthenticated(workspace)
    if (!isAuthenticated) {
      return NextResponse.json<TokensErrorResponse>({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    // Load domain config to get credits
    const passwords = loadDomainPasswords()
    const domainConfig = passwords[workspace]

    if (!domainConfig) {
      return NextResponse.json<TokensErrorResponse>({ ok: false, error: "Domain not found" }, { status: 404 })
    }

    const credits = domainConfig.credits ?? 0
    const tokens = creditsToLLMTokens(credits) // For backward compatibility

    return NextResponse.json<TokensResponse>({
      ok: true,
      tokens,
      credits,
      workspace,
    })
  } catch (error) {
    console.error("[Tokens] Error:", error)
    return NextResponse.json<TokensErrorResponse>(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
