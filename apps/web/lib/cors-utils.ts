import { NextResponse } from "next/server"
import { getAllowedOrigin } from "@/features/auth/types/guards"

export function addCorsHeaders(res: NextResponse, origin: string | null) {
  res.headers.set("Access-Control-Allow-Origin", getAllowedOrigin(origin))
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.headers.set("Access-Control-Allow-Credentials", "true")
  res.headers.set("Access-Control-Max-Age", "86400")
}

/**
 * Extract origin from request, falling back to referer header.
 * Used by every CORS-aware route — extracted here to avoid 30+ copies.
 */
export function getRequestOrigin(req: { headers: { get(name: string): string | null } }): string | null {
  return req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || null
}

/**
 * Shared CORS preflight handler. Drop-in replacement for the 26 identical
 * `export async function OPTIONS` blocks across API routes.
 */
export function corsOptionsHandler(req: { headers: { get(name: string): string | null } }): NextResponse {
  const origin = getRequestOrigin(req)
  const res = new NextResponse(null, { status: 204 })
  addCorsHeaders(res, origin)
  return res
}
