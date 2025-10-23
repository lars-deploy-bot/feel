import { NextResponse } from "next/server"
import { getAllowedOrigin, hasOrigin } from "@/types/guards/auth"

export function addCorsHeaders(res: NextResponse, origin?: string | null) {
  const allowedOrigin = hasOrigin(origin) ? getAllowedOrigin(origin) : getAllowedOrigin(null)

  res.headers.set("Access-Control-Allow-Origin", allowedOrigin)
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.headers.set("Access-Control-Allow-Credentials", "true")
  res.headers.set("Access-Control-Max-Age", "86400")
}
