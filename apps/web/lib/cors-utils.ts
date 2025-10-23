import { NextResponse } from "next/server"
import { getAllowedOrigin, hasOrigin } from "@/types/guards/auth"

export function addCorsHeaders(res: NextResponse, origin: string | null) {
  const allowedOrigin = origin ? (hasOrigin(origin) ? getAllowedOrigin(origin) : getAllowedOrigin(null)) : null

  res.headers.set("Access-Control-Allow-Origin", allowedOrigin || "https://terminal.goalive.nl")
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.headers.set("Access-Control-Allow-Credentials", "true")
  res.headers.set("Access-Control-Max-Age", "86400")
}
