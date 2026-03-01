import { isAllowedOrigin } from "@webalive/shared"
import { cors } from "hono/cors"

export const corsMiddleware = cors({
  origin: origin => (isAllowedOrigin(origin) ? origin : ""),
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposeHeaders: ["X-Request-Id"],
  maxAge: 86400,
})
