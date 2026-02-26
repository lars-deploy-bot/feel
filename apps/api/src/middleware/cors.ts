import { cors } from "hono/cors"

function isAllowedOrigin(origin: string): boolean {
  // Allow *.alive.best
  if (origin.endsWith(".alive.best") || origin === "https://alive.best") {
    return true
  }
  // Allow localhost on any port
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return true
  }
  // Allow 127.0.0.1 on any port
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
    return true
  }
  return false
}

export const corsMiddleware = cors({
  origin: origin => (isAllowedOrigin(origin) ? origin : ""),
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposeHeaders: ["X-Request-Id"],
  maxAge: 86400,
})
