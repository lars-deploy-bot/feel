import type { NextResponse } from "next/server"
import { getAllowedOrigin } from "@/features/auth/types/guards"

export function addCorsHeaders(res: NextResponse, origin: string | null) {
  res.headers.set("Access-Control-Allow-Origin", getAllowedOrigin(origin))
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.headers.set("Access-Control-Allow-Credentials", "true")
  res.headers.set("Access-Control-Max-Age", "86400")
}
