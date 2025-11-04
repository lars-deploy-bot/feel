import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { deleteDomainPassword, loadDomainPasswords, updateDomainPassword } from "@/types/guards/api"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
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

    await updateDomainPassword(domain, password)
    const res = NextResponse.json({ ok: true })
    addCorsHeaders(res, origin)
    return res
  } catch (_error) {
    const res = NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  }
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")
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
  } catch (_error) {
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
