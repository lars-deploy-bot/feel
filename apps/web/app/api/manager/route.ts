import { NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { loadDomainPasswords, saveDomainPasswords, updateDomainPassword, deleteDomainPassword } from "@/types/guards/api"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  // Check if user is authenticated as manager
  const jar = await cookies()
  if (!jar.get("manager_session")) {
    const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    addCorsHeaders(res, origin)
    return res
  }

  const domains = loadDomainPasswords()
  const res = NextResponse.json({ ok: true, domains })
  addCorsHeaders(res, origin)
  return res
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  // Check if user is authenticated as manager
  const jar = await cookies()
  if (!jar.get("manager_session")) {
    const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { domain, password } = body

    if (!domain || !password) {
      const res = NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 })
      addCorsHeaders(res, origin)
      return res
    }

    updateDomainPassword(domain, password)
    const res = NextResponse.json({ ok: true })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    const res = NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  }
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")

  // Check if user is authenticated as manager
  const jar = await cookies()
  if (!jar.get("manager_session")) {
    const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { domain } = body

    if (!domain) {
      const res = NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 })
      addCorsHeaders(res, origin)
      return res
    }

    deleteDomainPassword(domain)
    const res = NextResponse.json({ ok: true })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    const res = NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}