import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { loadDomainPasswords } from "@/types/guards/api"

export async function GET(req: NextRequest) {
  try {
    const jar = await cookies()
    const workspace = req.headers.get("X-Workspace")

    if (!workspace) {
      return NextResponse.json({ ok: false, error: "No workspace specified" }, { status: 400 })
    }

    // Verify user is authenticated for this workspace
    const sessionCookie = jar.get(`${workspace}-session`)
    if (!sessionCookie) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    // Load domain config to get tokens
    const passwords = loadDomainPasswords()
    const domainConfig = passwords[workspace]

    if (!domainConfig) {
      return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 })
    }

    const tokens = domainConfig.tokens ?? 200

    return NextResponse.json({
      ok: true,
      tokens,
      workspace,
    })
  } catch (error) {
    console.error("[Tokens] Error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
